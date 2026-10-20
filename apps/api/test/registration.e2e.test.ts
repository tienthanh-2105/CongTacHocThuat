import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { RegistrationService } from '../src/business/registration/registration.service';
import { RegistrationRepository } from '../src/data/repositories/registration/registration.repository';

test('Registration Service Unit & Integration Logic', async (t) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();

  const regService = app.get(RegistrationService);
  const regRepo = app.get(RegistrationRepository);

  await t.test('can find student by user account ID', async () => {
    // Account MaTK = 7 is student 2001230001
    const student = await regRepo.findStudentByUserId(7);
    assert.ok(student, 'Student should be found for account 7');
    assert.equal(student.MSSV, '2001230001');
    assert.equal(student.HoTen, 'Nguyễn Văn An');
  });

  await t.test('can find student by MSSV', async () => {
    const student = await regRepo.findStudentByMssv('2001230002');
    assert.ok(student, 'Student should be found for MSSV 2001230002');
    assert.equal(student.HoTen, 'Trần Thị Bình');
  });

  await t.test('can query competitions and activities', async () => {
    const comp = await regRepo.findCompetitionById(1);
    assert.ok(comp, 'Competition 1 should exist');
    assert.equal(comp.MaHD, 1);
  });

  await t.test('support assignments query returns list or empty array', async () => {
    const assignments = await regService.getSupportAssignments(1);
    assert.ok(Array.isArray(assignments));
  });

  await app.close();
});
