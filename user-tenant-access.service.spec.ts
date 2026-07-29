import { Test, TestingModule } from '@nestjs/testing';
import { UserTenantAccessService } from './user-tenant-access.service';
import { PrismaService } from '../../common/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('UserTenantAccessService', () => {
  let service: UserTenantAccessService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userTenantAccess: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTenantAccessService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UserTenantAccessService>(UserTenantAccessService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignAccess', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-456';
    const role = 'ADMIN';

    it('should throw ConflictException if access already exists', async () => {
      mockPrismaService.userTenantAccess.findUnique.mockResolvedValue({ id: 'existing-access' });

      await expect(service.assignAccess(userId, tenantId, role)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.userTenantAccess.findUnique).toHaveBeenCalledWith({
        where: { userId_tenantId: { userId, tenantId } },
      });
    });

    it('should create user tenant access if not exists', async () => {
      mockPrismaService.userTenantAccess.findUnique.mockResolvedValue(null);
      mockPrismaService.userTenantAccess.create.mockResolvedValue({ userId, tenantId, role });

      const result = await service.assignAccess(userId, tenantId, role, 'contact-789');

      expect(result).toEqual({ userId, tenantId, role });
      expect(mockPrismaService.userTenantAccess.create).toHaveBeenCalledWith({
        data: { userId, tenantId, role, contactId: 'contact-789' },
      });
    });
  });

  describe('removeAccess', () => {
    it('should delete user tenant access', async () => {
      mockPrismaService.userTenantAccess.delete.mockResolvedValue({ deleted: true });

      const result = await service.removeAccess('user-123', 'tenant-456');

      expect(result).toEqual({ deleted: true });
      expect(mockPrismaService.userTenantAccess.delete).toHaveBeenCalledWith({
        where: { userId_tenantId: { userId: 'user-123', tenantId: 'tenant-456' } },
      });
    });
  });

  describe('getUserTenants', () => {
    it('should return user tenants', async () => {
      const mockUserTenants = [{ userId: 'user-123', tenantId: 'tenant-456' }];
      mockPrismaService.userTenantAccess.findMany.mockResolvedValue(mockUserTenants);

      const result = await service.getUserTenants('user-123');

      expect(result).toEqual(mockUserTenants);
      expect(mockPrismaService.userTenantAccess.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', active: true },
        include: { tenant: true },
      });
    });
  });

  describe('getTenantUsers', () => {
    it('should return tenant users', async () => {
      const mockTenantUsers = [{ userId: 'user-123', tenantId: 'tenant-456' }];
      mockPrismaService.userTenantAccess.findMany.mockResolvedValue(mockTenantUsers);

      const result = await service.getTenantUsers('tenant-456');

      expect(result).toEqual(mockTenantUsers);
      expect(mockPrismaService.userTenantAccess.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-456', active: true },
        include: { user: true },
      });
    });
  });
});
