package vn.edu.cong_tac_hoc_thuat

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.StandardMethodCodec
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.roundToInt

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        MethodChannel(
            messenger, "academic/notice_pdf", StandardMethodCodec.INSTANCE,
            messenger.makeBackgroundTaskQueue()
        ).setMethodCallHandler { call, result ->
            if (call.method != "renderPage") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            try {
                val pdf = requireNotNull(call.argument<ByteArray>("pdf"))
                val index = requireNotNull(call.argument<Int>("index"))
                result.success(renderPdfPage(pdf, index))
            } catch (_: Exception) {
                result.error("PDF_UNAVAILABLE", "Không thể mở tệp PDF này.", null)
            }
        }
    }

    private fun renderPdfPage(pdf: ByteArray, index: Int): Map<String, Any> {
        val file = File.createTempFile("notice-", ".pdf", cacheDir)
        try {
            file.writeBytes(pdf)
            val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val renderer = try {
                PdfRenderer(descriptor)
            } catch (error: Exception) {
                descriptor.close()
                throw error
            }
            return renderer.use {
                renderer.openPage(index).use { page ->
                    val scale = 1800.0 / maxOf(page.width, page.height)
                    val width = (page.width * scale).roundToInt().coerceAtLeast(1)
                    val height = (page.height * scale).roundToInt().coerceAtLeast(1)
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    try {
                        bitmap.eraseColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        val output = ByteArrayOutputStream()
                        check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output))
                        mapOf("count" to renderer.pageCount, "image" to output.toByteArray())
                    } finally {
                        bitmap.recycle()
                    }
                }
            }
        } finally {
            file.delete()
        }
    }
}
