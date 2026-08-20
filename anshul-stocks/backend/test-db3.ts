import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { IpoSyncService } from './src/providers/sync/ipo-sync.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const svc = app.get(IpoSyncService);
  const data = await svc.getCurrentIpos();
  const shankesh = [...data.live, ...data.upcoming].find(i => i.companyName.includes('Shankesh'));
  console.log("Shankesh:", shankesh);
  process.exit(0);
}
bootstrap();
