import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { ListTranscriptsQueryDto } from "./dto/transcript.dto";
import { TranscriptionService } from "./transcription.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/transcripts")
export class TranscriptController {
  constructor(
    private readonly transcription: TranscriptionService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListTranscriptsQueryDto) {
    return this.transcription.list(this.tenant.fromUser(user), query);
  }

  @Get("call/:callId")
  byCall(@CurrentUser() user: JwtPayload, @Param("callId", ParseUUIDPipe) callId: string) {
    return this.transcription.getByCallId(this.tenant.fromUser(user), callId);
  }

  @Get(":id/segments")
  segments(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) transcriptId: string) {
    return this.transcription.segments(this.tenant.fromUser(user), transcriptId);
  }

  @Post(":id/reprocess")
  reprocess(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) transcriptId: string,
  ) {
    return this.transcription.reprocess(this.tenant.fromUser(user), transcriptId);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) transcriptId: string) {
    return this.transcription.getById(this.tenant.fromUser(user), transcriptId);
  }
}
