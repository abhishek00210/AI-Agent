import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { ListRecordingsQueryDto } from "./dto/recording.dto";
import { RecordingService } from "./recording.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/recordings")
export class RecordingController {
  constructor(
    private readonly recordings: RecordingService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListRecordingsQueryDto) {
    return this.recordings.list(this.tenant.fromUser(user), query);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) recordingId: string) {
    return this.recordings.getById(this.tenant.fromUser(user), recordingId);
  }

  @Get(":id/download")
  download(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) recordingId: string) {
    return this.recordings.download(this.tenant.fromUser(user), recordingId);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) recordingId: string) {
    return this.recordings.delete(this.tenant.fromUser(user), recordingId);
  }
}
