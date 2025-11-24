import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from './auth.types';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string;
};

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET ?? 'local-dev-secret';

  constructor(private readonly db: DatabaseService) {}

  async register(dto: RegisterDto) {
    const existing = this.db.get<UserRecord>(
      'SELECT * FROM users WHERE email = ?',
      [dto.email],
    );
    if (existing) {
      throw new BadRequestException('이미 가입된 이메일입니다.');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    this.db.run(
      `INSERT INTO users (id, email, password_hash, display_name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, dto.email, passwordHash, dto.displayName, now],
    );

    const user: AuthUser = {
      id,
      email: dto.email,
      displayName: dto.displayName,
    };
    return { user, token: this.signToken(user) };
  }

  async login(dto: LoginDto) {
    const record = this.db.get<UserRecord>(
      'SELECT * FROM users WHERE email = ?',
      [dto.email],
    );
    if (!record) {
      throw new UnauthorizedException('이메일 또는 비밀번호를 확인하세요.');
    }
    const valid = await bcrypt.compare(dto.password, record.password_hash);
    if (!valid) {
      throw new UnauthorizedException('이메일 또는 비밀번호를 확인하세요.');
    }

    const user: AuthUser = {
      id: record.id,
      email: record.email,
      displayName: record.display_name,
    };
    return { user, token: this.signToken(user) };
  }

  verifyToken(token: string): AuthUser {
    try {
      return jwt.verify(token, this.jwtSecret) as AuthUser;
    } catch {
      throw new UnauthorizedException('토큰이 유효하지 않습니다.');
    }
  }

  private signToken(user: AuthUser) {
    return jwt.sign(user, this.jwtSecret, { expiresIn: '7d' });
  }
}
