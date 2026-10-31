import { NextResponse } from "next/server";
import { jsonOk, withApi } from "@/shared/http";
import { getFunctionCatalog } from "@/shared/formula/engine";
import { UNITS } from "@/shared/formula/units";

/** GET /api/formula/functions — کاتالوگ توابع بسته DSL + واحدهای رجیستری (راهنمای فرمول‌نویسی). */
export const GET = withApi(async () => {
  return jsonOk({
    functions: getFunctionCatalog(),
    units: Object.entries(UNITS).map(([symbol, def]) => ({
      symbol,
      nameFa: def.nameFa,
      dimension: def.dimension,
    })),
    limits: {
      maxExprLength: 2048,
      maxNodeCount: 512,
      maxAstDepth: 64,
    },
    operators: ["+", "-", "*", "/", "%", "==", "!=", "<", "<=", ">", ">=", "&&", "||", "!"],
  });
});
