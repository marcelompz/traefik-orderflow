import { Test, TestingModule } from '@nestjs/testing';
import { QuotationsService } from './quotations.service';
import { PrismaService } from '../common/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('QuotationsService', () => {
  let service: QuotationsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    moduleInstallation: {
      findUnique: jest.fn(),
    },
    quotation: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createQuotation', () => {
    const tenantId = 'tenant-123';
    const mockData = {
      customerId: 'customer-456',
      notes: 'test notes',
      items: [
        { productId: 'prod-1', quantity: 2, unitPrice: 100, totalPrice: 200 },
        { productId: 'prod-2', quantity: 1, unitPrice: 150, totalPrice: 150 },
      ],
    };

    it('should throw BadRequestException if quotations module is not installed or inactive', async () => {
      mockPrismaService.moduleInstallation.findUnique.mockResolvedValue(null);

      await expect(service.createQuotation(tenantId, mockData)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if quotations module is inactive', async () => {
      mockPrismaService.moduleInstallation.findUnique.mockResolvedValue({ active: false });

      await expect(service.createQuotation(tenantId, mockData)).rejects.toThrow(BadRequestException);
    });

    it('should successfully create a quotation with default validity days (15)', async () => {
      mockPrismaService.moduleInstallation.findUnique.mockResolvedValue({ active: true, config: {} });
      const mockCreatedQuotation = { id: 'quotation-789', items: mockData.items };
      mockPrismaService.quotation.create.mockResolvedValue(mockCreatedQuotation);

      const result = await service.createQuotation(tenantId, mockData);

      expect(result).toEqual(mockCreatedQuotation);
      expect(mockPrismaService.quotation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          customerId: mockData.customerId,
          totalAmount: 350,
          notes: mockData.notes,
        }),
        include: { items: true },
      });
    });

    it('should use custom validity days and terms from module config', async () => {
      mockPrismaService.moduleInstallation.findUnique.mockResolvedValue({
        active: true,
        config: { validityDays: 30, termsAndConditions: 'Custom Terms' },
      });
      const mockCreatedQuotation = { id: 'quotation-789', items: mockData.items };
      mockPrismaService.quotation.create.mockResolvedValue(mockCreatedQuotation);

      await service.createQuotation(tenantId, mockData);

      const createArgs = mockPrismaService.quotation.create.mock.calls[0][0].data;
      expect(createArgs.notes).toBe('Custom Terms');
      const diffTime = Math.abs(createArgs.validUntil.getTime() - new Date().getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });
  });

  describe('getQuotations', () => {
    it('should return all quotations for a tenant', async () => {
      const mockQuotations = [{ id: 'q-1', tenantId: 'tenant-123' }];
      mockPrismaService.quotation.findMany.mockResolvedValue(mockQuotations);

      const result = await service.getQuotations('tenant-123');

      expect(result).toEqual(mockQuotations);
      expect(mockPrismaService.quotation.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      });
    });
  });
});
