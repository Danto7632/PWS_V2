import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SimulationsService } from './simulations.service';
import { MessageRequestDto } from './dto/message-request.dto';
import { ScenarioRequestDto } from './dto/scenario-request.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';

@ApiTags('Simulations')
@Controller('api/simulations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Post('scenario')
  @ApiOperation({ summary: '직원 역할 최초 시나리오 생성' })
  generateScenario(
    @Body() body: ScenarioRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.simulationsService.generateScenario(
      body.conversationId,
      body.providerConfig,
      user,
    );
  }

  @Post('customer/respond')
  @ApiOperation({ summary: '고객 역할 응답 생성 (AI 직원)' })
  respondAsCustomer(
    @Body() body: MessageRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.simulationsService.customerRespond(
      body.conversationId,
      body.message,
      body.providerConfig,
      user,
    );
  }

  @Post('employee/respond')
  @ApiOperation({ summary: '직원 역할 응답 생성 및 평가' })
  respondAsEmployee(
    @Body() body: MessageRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.simulationsService.employeeRespond(
      body.conversationId,
      body.message,
      body.providerConfig,
      user,
    );
  }
}
