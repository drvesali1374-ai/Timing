/**
 * دامنه ماژول بالانس — اعتبارسنجی ورودی‌های API (فاز ۶ / B10).
 * منطق خالص موتور در shared/balance است — اینجا فقط زد/اسکیمای مرز API.
 */

import { z } from "zod";
import { TIME_BASES } from "@/shared/balance/types";
import { isBalanceAlgorithmId } from "@/shared/balance/algorithms";
import { BALANCE_ALGORITHM_IDS } from "@/shared/balance/types";

// ─────────────────────── ورودی سناریو ───────────────────────

export const taktInputSchema = z
  .object({
    taktMs: z.number().positive().int().max(86_400_000).nullable().optional(),
    demandUnits: z.number().positive().max(10_000_000).nullable().optional(),
    netAvailableMsPerShift: z.number().positive().max(86_400_000).nullable().optional(),
    shiftsPerPeriod: z.number().positive().int().max(30).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.taktMs == null) {
      // بدون تاکت مستقیم: تقاضا + زمان خالص + شیفت لازم است
      if (v.demandUnits == null || v.netAvailableMsPerShift == null || v.shiftsPerPeriod == null) {
        ctx.addIssue({
          code: "custom",
          message: "تاکت مستقیم (taktMs) یا مجموع تقاضا + زمان خالص در دسترس + تعداد شیفت لازم است.",
        });
      }
    }
  });

export const objectiveWeightsSchema = z.object({
  minimizeStations: z.number().min(0).max(1).default(0.4),
  smoothLoad: z.number().min(0).max(1).default(0.4),
  minChanges: z.number().min(0).max(1).default(0.2),
});

export const scenarioInputsSchema = z.object({
  timeBasis: z.enum(TIME_BASES).default("standard"),
  takt: taktInputSchema.default({ taktMs: null, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null }),
  maxStations: z.number().int().positive().max(200).nullable().default(null),
  objectives: objectiveWeightsSchema.default({ minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 }),
  activityTimeOverrides: z.record(z.string(), z.number().min(0).max(86_400_000)).default({}),
  referenceAssignment: z.record(z.string(), z.number().int().positive().max(200)).nullable().default(null),
});

export const createScenarioSchema = z.object({
  name: z.string().trim().min(1, "نام سناریو الزامی است.").max(120),
  inputs: scenarioInputsSchema,
  notes: z.string().max(2000).nullable().optional(),
});

export const updateScenarioSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  inputs: scenarioInputsSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

// ─────────────────────── اجرا / تخصیص دستی ───────────────────────

export const solveSchema = z.object({
  algorithm: z.string().refine(isBalanceAlgorithmId, {
    message: `الگوریتم باید یکی از این‌ها باشد: ${BALANCE_ALGORITHM_IDS.join("، ")}.`,
  }),
  timeBudgetMs: z.number().int().positive().max(60_000).optional(),
});

export const manualAssignmentSchema = z.object({
  /** تخصیص کامل — stableKey → ایستگاه ۱-مبنا */
  assignments: z.record(z.string(), z.number().int().positive().max(200)),
});

// ─────────────────────── انواع خروجی ───────────────────────

export type TaktInputParsed = z.infer<typeof taktInputSchema>;
export type ScenarioInputsParsed = z.infer<typeof scenarioInputsSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
export type SolveInput = z.infer<typeof solveSchema>;
export type ManualAssignmentInput = z.infer<typeof manualAssignmentSchema>;
