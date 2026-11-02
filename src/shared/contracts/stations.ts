/**
 * قراردادهای مشترک ایستگاه‌های کاری (ADR-017) — مصرف UI و ماژول‌ها.
 */

export interface StationDto {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  archived: boolean;
  activityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BulkCreateStationsResult {
  created: StationDto[];
  skipped: { name: string; reasonFa: string }[];
}
