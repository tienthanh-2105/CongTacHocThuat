import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationRepository } from '../../data/repositories/registration/registration.repository';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(RegistrationRepository)
    private readonly repository: RegistrationRepository,
  ) {}

  async getSupportAssignments(activityId: number) {
    const activity = await this.repository.findActivityById(activityId);
    if (!activity) {
      throw new NotFoundException(`Không tìm thấy hoạt động với mã: ${activityId}`);
    }
    return this.repository.getSupportAssignments(activityId);
  }
}
