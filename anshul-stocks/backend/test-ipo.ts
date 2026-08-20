import { ExternalIpoApiProvider } from './src/providers/ipo.provider';
import { IPOMapper } from './src/providers/mappers/ipo.mapper';

class TestIpoProvider extends ExternalIpoApiProvider {
  constructor() {
    super({ get: () => 'mock' } as any); // mock configService
  }
  public testNormalize(raw: any) {
    return (this as any).normalizeRecord(raw);
  }
}

const rawShankesh = {
  "name": "Shankesh Jewellers",
  "greyMarketPremium": {
    "gmpSource": "https://ipowatch.in/shankesh-jewellers-ipo-gmp-grey-market-premium",
    "gmpTrends": [
      {
        "date": "20 August",
        "gmp": "₹2",
        "gain": "2.15%"
      }
    ]
  }
};

const provider = new TestIpoProvider();
const normalized = provider.testNormalize(rawShankesh);
console.log("Normalized GMP:", normalized.gmp);
console.log("Normalized GMP typeof:", typeof normalized.gmp);

const dto = IPOMapper.toIPODTO(normalized);
console.log("DTO GMP:", dto.gmp);
console.log("DTO GMP typeof:", typeof dto.gmp);
