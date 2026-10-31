/**
 * اسکیماهای اعتبارسنجی zod — یک منبع برای فرم‌های UI و routeهای سرور.
 * فاز ۱: ایجاد/ویرایش پروژه، افزودن عضو، جست‌وجوی لیست.
 */
import { z } from "zod";
import { ASSIGNABLE_ROLES } from "../contracts/acl";

const trimmed = (min: number, max: number) =>
  z.string().trim().min(min, `حداقل ${min} نویسه`).max(max, `حداکثر ${max} نویسه`);

export const projectInfoSchema = z.object({
  title: trimmed(2, 120),
  code: trimmed(2, 40).regex(
    /^[A-Za-z0-9\u0600-\u06FF][A-Za-z0-9\u0600-\u06FF._-]*$/,
    "کد فقط می‌تواند شامل حرف، رقم، نقطه، خط تیره و زیرخط باشد",
  ),
  goal: z.string().trim().max(2000).optional().default(""),
  location: z.string().trim().max(200).optional().default(""),
  department: z.string().trim().max(200).optional().default(""),
  line: z.string().trim().max(200).optional().default(""),
  station: z.string().trim().max(200).optional().default(""),
  product: z.string().trim().max(200).optional().default(""),
  process: z.string().trim().max(200).optional().default(""),
  responsible: z.string().trim().max(200).optional().default(""),
  shift: z.string().trim().max(100).optional().default(""),
  notes: z.string().trim().max(4000).optional().default(""),
});
export type ProjectInfoInput = z.infer<typeof projectInfoSchema>;

/** لغات اجزای پروفایل هنگام ایجاد پروژه */
export const profileComponentsSchema = z.object({
  excludedFamilies: z.array(z.string().min(1)).max(50).optional().default([]),
  parameterOverrides: z
    .array(
      z.object({
        stableKey: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    )
    .max(100)
    .optional()
    .default([]),
});
export type ProfileComponentsInput = z.infer<typeof profileComponentsSchema>;

export const projectCreateSchema = projectInfoSchema.extend({
  profileTemplateId: z.string().trim().min(1, "انتخاب پروفایل الزامی است"),
  profileComponents: profileComponentsSchema.optional(),
  isDemo: z.boolean().optional().default(false),
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectInfoSchema.partial().refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "حداقل یک فیلد برای ویرایش لازم است" },
);
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const projectArchiveSchema = z.object({
  archived: z.boolean(),
});

export const projectListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["all", "active", "archived", "completed"]).optional().default("all"),
  demo: z.enum(["include", "exclude", "only"]).optional().default("include"),
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const memberAddSchema = z.object({
  email: z.string().trim().toLowerCase().email("نشانی رایانامه معتبر نیست"),
  role: z.enum(ASSIGNABLE_ROLES as unknown as [string, ...string[]]),
});
export type MemberAddInput = z.infer<typeof memberAddSchema>;

export const memberUpdateSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES as unknown as [string, ...string[]]),
});

export const registerSchema = z.object({
  name: trimmed(2, 100),
  email: z.string().trim().toLowerCase().email("نشانی رایانامه معتبر نیست"),
  password: z
    .string()
    .min(8, "گذرواژه حداقل ۸ نویسه")
    .max(128, "گذرواژه حداکثر ۱۲۸ نویسه"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("نشانی رایانامه معتبر نیست"),
  password: z.string().min(1, "گذرواژه الزامی است"),
});
