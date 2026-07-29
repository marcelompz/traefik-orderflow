import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { PrismaService } from '../common/prisma.service';
import { CloudflareDnsService } from '../cloudflare/cloudflare-dns.service';

describe('TenantsController', () => {
  let controller: TenantsController;
  let prismaService: PrismaService;

  const mockPrismaService = {
    tenant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCloudflareDnsService = {
    ensureSubdomain: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CloudflareDnsService, useValue: mockCloudflareDnsService },
      ],
    }).compile();


    controller = module.get<TenantsController>(TenantsController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const mockTenantData = {
      name: 'Test Tenant',
      businessName: 'Test SRL',
      branding: {
        primaryColor: '#5B3A7B',
        secondaryColor: '#00B4D8',
      },
    };

    const mockCreatedTenant = {
      id: 'tenant-001',
      name: 'Test Tenant',
      apiKeySecret: 'sk_test_123',
      createdAt: new Date(),
    };

    it('should create a new tenant successfully', async () => {
      mockPrismaService.tenant.create.mockResolvedValue(mockCreatedTenant);

      const result = await controller.create(mockTenantData);

      expect(result).toEqual({
        id: 'tenant-001',
        name: 'Test Tenant',
        apiKey: 'sk_test_123',
        message: expect.stringContaining('Tenant creado'),
      });
      expect(prismaService.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Tenant',
          businessName: 'Test SRL',
          primaryColor: '#5B3A7B',
        }),
        select: expect.any(Object),
      });
    });

    it('should generate unique API key for each tenant', async () => {
      mockPrismaService.tenant.create.mockResolvedValue(mockCreatedTenant);

      await controller.create(mockTenantData);

      const callArgs = mockPrismaService.tenant.create.mock.calls[0][0].data;
      expect(callArgs.apiKeySecret).toMatch(/^sk_[a-zA-Z0-9]+$/);
    });
  });

  describe('my-tenants', () => {
    const mockTenants = [
      {
        id: 'tenant-001',
        name: 'Tenant 1',
        apiKeySecret: 'sk_001',
        active: true,
      },
      {
        id: 'tenant-002',
        name: 'Tenant 2',
        apiKeySecret: 'sk_002',
        active: true,
      },
    ];

    it('should return all tenants for superadmin', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);

      const mockReq = { user: { sub: 'admin-001' }, isSuperAdmin: true };
      const result = await controller.findMyTenants(mockReq as any);

      expect(result.tenants).toHaveLength(2);
      expect(result.isMultiTenant).toBe(true);
    });

    it('should return tenants count correctly', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([mockTenants[0]]);

      const mockReq = { user: { sub: 'admin-001' }, isSuperAdmin: true };
      const result = await controller.findMyTenants(mockReq as any);

      expect(result.count).toBe(1);
    });
  });
});
