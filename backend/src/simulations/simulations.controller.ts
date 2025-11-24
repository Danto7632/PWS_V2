import { Body, Controller, Post } from '@nestjs/common';
import { SimulationsService } from './simulations.service';
import { MessageRequestDto } from './dto/message-request.dto';
import { ScenarioRequestDto } from './dto/scenario-request.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Simulations')
@Controller('api/simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Post('scenario')
  @ApiOperation({ summary: '직원 역할 최초 시나리오 생성' })
  generateScenario(@Body() body: ScenarioRequestDto) {
    return this.simulationsService.generateScenario(body.providerConfig);
  }

  @Post('customer/respond')
  @ApiOperation({ summary: '고객 역할 응답 생성 (AI 직원)' })
  respondAsCustomer(@Body() body: MessageRequestDto) {
    return this.simulationsService.customerRespond(
      body.message,
      body.providerConfig,
    );
  }

  @Post('employee/respond')
  @ApiOperation({ summary: '직원 역할 응답 생성 및 평가' })
  respondAsEmployee(@Body() body: MessageRequestDto) {
    return this.simulationsService.employeeRespond(
      body.message,
      body.providerConfig,
    );
  }
}
