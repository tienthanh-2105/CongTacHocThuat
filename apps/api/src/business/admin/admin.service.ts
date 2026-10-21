import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AdminRepository } from '../../data/repositories/admin/admin.repository';
import type {
  CreateCompetitionCommitteeDto,
  CreateManagedUserDto,
  CreatePlanDto,
  ReviewPlanDto,
  UpdateManagedUserDto,
} from '../../presentation/admin/admin.dto';

@Injectable()
export class AdminService {
  constructor(@Inject(AdminRepository) private readonly repository: AdminRepository) {}

  listUsers(search?: string) {
    return this.repository.listUsers(search);
  }

  async createUser(dto: CreateManagedUserDto) {
    const passwordHash = await hash(dto.matKhau, 12);
    const id = await this.repository.createUser(dto, passwordHash);
    return this.repository.getUser(id);
  }

  async updateUser(id: number, dto: UpdateManagedUserDto) {
    const passwordHash = dto.matKhauMoi ? await hash(dto.matKhauMoi, 12) : undefined;
    const user = await this.repository.updateUser(id, dto, passwordHash);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return user;
  }

  listRoles() {
    return this.repository.listRoles();
  }

  listPermissions() {
    return this.repository.listPermissions();
  }

  updateRolePermissions(roleId: number, permissionIds: number[]) {
    return this.repository.updateRolePermissions(roleId, permissionIds);
  }

  listPlans() {
    return this.repository.listPlans();
  }

  async getPlan(id: number) {
    const plan = await this.repository.getPlan(id);
    if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    return plan;
  }

  createPlan(dto: CreatePlanDto, accountId: string) {
    return this.repository.createPlan(dto, Number(accountId));
  }

  submitPlan(id: number, accountId: string) {
    return this.repository.changePlanStatus(id, Number(accountId), 'Chờ duyệt', undefined, true);
  }

  reviewPlan(id: number, accountId: string, dto: ReviewPlanDto) {
    return this.repository.changePlanStatus(id, Number(accountId), dto.trangThai, dto.noiDung, false);
  }

  listCompetitions() {
    return this.repository.listCompetitions();
  }

  async listCompetitionBoards(competitionId: number) {
    const boards = await this.repository.listCompetitionBoards(competitionId);
    if (!boards) throw new NotFoundException('Không tìm thấy cuộc thi');
    return boards;
  }

  createCompetitionBoard(competitionId: number, dto: CreateCompetitionCommitteeDto) {
    return this.repository.createCompetitionBoard(competitionId, dto);
  }
}
