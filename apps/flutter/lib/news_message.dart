import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class NewsMessage {
  const NewsMessage(this.text, {this.pdfData, this.pdfName, this.image});

  final String text;
  final String? pdfData;
  final String? pdfName;
  final String? image;

  factory NewsMessage.parse(String raw) {
    final content = raw.trim();
    if (content.startsWith('{')) {
      try {
        final value = jsonDecode(content);
        if (value is Map<String, dynamic> &&
            (value.containsKey('isPdf') ||
                value.containsKey('pdfData') ||
                value.containsKey('image'))) {
          return NewsMessage(
            _string(value['text']) ?? '',
            pdfData: _string(value['pdfData']),
            pdfName: _string(value['pdfName']),
            image: _string(value['image']),
          );
        }
      } on FormatException {
        // Older notices can contain ordinary text starting with a brace.
      }
    }
    return NewsMessage(content);
  }

  static String? _string(Object? value) =>
      value is String && value.trim().isNotEmpty ? value.trim() : null;

  String get attachmentName => pdfName ?? 'Tài liệu PDF';

  String get summary {
    if (text.isNotEmpty) return text;
    if (pdfData != null) return 'Đính kèm: $attachmentName';
    if (image != null) return 'Có hình ảnh đính kèm';
    return 'Bạn có thông báo mới.';
  }

  Widget details(BuildContext context) {
    final imageData = image;
    final pdf = pdfData;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (text.isNotEmpty || (pdf == null && imageData == null))
          SelectableText(summary),
        if (imageData != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: _noticeImage(imageData),
          ),
        if (pdf != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.picture_as_pdf_outlined),
            title: Text(attachmentName),
            subtitle: const Text('Mở tệp PDF'),
            onTap: () => Navigator.of(context).push<void>(MaterialPageRoute(
              builder: (_) => _NoticePdfScreen(name: attachmentName, data: pdf),
            )),
          ),
      ],
    );
  }

  Widget _noticeImage(String source) {
    const unavailable = Text('Không thể mở hình ảnh đính kèm.');
    Widget imageError(BuildContext context, Object error, StackTrace? stack) =>
        unavailable;
    try {
      final uri = Uri.parse(source);
      final data = uri.data;
      if (data != null && data.mimeType.startsWith('image/')) {
        return Image.memory(data.contentAsBytes(), errorBuilder: imageError);
      }
      if (uri.scheme == 'https' || uri.scheme == 'http') {
        return Image.network(source, errorBuilder: imageError);
      }
    } on FormatException {
      return unavailable;
    }
    return unavailable;
  }
}

class _NoticePdfScreen extends StatefulWidget {
  const _NoticePdfScreen({required this.name, required this.data});

  final String name;
  final String data;

  @override
  State<_NoticePdfScreen> createState() => _NoticePdfScreenState();
}

class _NoticePdfScreenState extends State<_NoticePdfScreen> {
  static const _channel = MethodChannel('academic/notice_pdf');
  late final Future<Uint8List> _bytes;
  late Future<Map<String, dynamic>?> _page;
  int _index = 0;
  int _pageCount = 0;

  @override
  void initState() {
    super.initState();
    _bytes = Future.sync(() {
      final pdf = UriData.parse(widget.data);
      if (pdf.mimeType != 'application/pdf') {
        throw const FormatException('Invalid PDF MIME type');
      }
      return pdf.contentAsBytes();
    });
    _page = _renderPage(0);
  }

  Future<Map<String, dynamic>?> _renderPage(int index) async {
    final bytes = await _bytes;
    final page = await _channel.invokeMapMethod<String, dynamic>(
      'renderPage',
      {'pdf': bytes, 'index': index},
    );
    _pageCount = page?['count'] as int? ?? 0;
    return page;
  }

  void _goTo(int index) => setState(() {
        _index = index;
        _page = _renderPage(index);
      });

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(widget.name)),
        body: FutureBuilder<Map<String, dynamic>?>(
          future: _page,
          builder: (context, snapshot) {
            final ready = snapshot.connectionState == ConnectionState.done;
            final bytes =
                ready ? (snapshot.data?['image'] as Uint8List?) : null;
            return SafeArea(
              child: Column(children: [
                Expanded(
                  child: Center(
                    child: !ready
                        ? const CircularProgressIndicator()
                        : bytes == null
                            ? const Text('Không thể mở tệp PDF này.')
                            : InteractiveViewer(
                                key: ValueKey(_index),
                                maxScale: 5,
                                child: Image.memory(bytes, fit: BoxFit.contain),
                              ),
                  ),
                ),
                if (_pageCount > 1)
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    IconButton(
                      tooltip: 'Trang trước',
                      onPressed:
                          ready && _index > 0 ? () => _goTo(_index - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('Trang ${_index + 1} / $_pageCount'),
                    IconButton(
                      tooltip: 'Trang sau',
                      onPressed: ready && _index + 1 < _pageCount
                          ? () => _goTo(_index + 1)
                          : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ]),
              ]),
            );
          },
        ),
      );
}
