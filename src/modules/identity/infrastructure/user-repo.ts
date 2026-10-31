/**
 * زیرساخت ماژول هویت — دسترسی‌های Prisma به جدول User.
 * فقط این لایه از ماژول با Prisma کار می‌کند (قاعده لایه‌ها).
 */
import { db } from "@/lib/db";

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  authProvider: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return db.user.findUnique({ where: { email } });
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  return db.user.findUnique({ where: { id } });
}

export async function createUser(data: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  authProvider: string;
}): Promise<UserRecord> {
  return db.user.create({ data });
}

/** فهرست کاربران بر اساس رایانامه — برای افزودن عضو به پروژه. */
export async function findUsersByEmails(emails: string[]): Promise<UserRecord[]> {
  if (emails.length === 0) return [];
  return db.user.findMany({ where: { email: { in: emails } } });
}
