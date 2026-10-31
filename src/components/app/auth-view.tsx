"use client";

/**
 * نمای احراز هویت — ورود/ثبت‌نام + دکمه ورود سریع به حساب نمونه آموزشی.
 */
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, LogIn, Timer, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useLogin, useRegister } from "@/hooks/use-api";
import { Spinner } from "./ui-bits";

const DEMO_EMAIL = "demo@timing.local";
const DEMO_PASSWORD = "demo1234";

export function AuthView() {
  const login = useLogin();
  const register = useRegister();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", email: "", password: "" });

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error("رایانامه و گذرواژه را وارد کنید.");
      return;
    }
    login.mutate(loginForm);
  };

  const submitRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.password.length < 8) {
      toast.error("گذرواژه باید حداقل ۸ نویسه باشد.");
      return;
    }
    register.mutate(regForm, {
      onSuccess: () => {
        // پس از ثبت‌نام موفق، مستقیم وارد شویم
        login.mutate({ email: regForm.email, password: regForm.password });
      },
    });
  };

  const demoLogin = () => {
    login.mutate({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-950 dark:to-stone-900 p-4">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Timer className="size-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">زمان‌سنجی صنعتی</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          پلتفرم ماژولار زمان‌سنجی، مطالعه کار، نمودارهای فرایندی و بالانس خط تولید
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ورود به پلتفرم</CardTitle>
          <CardDescription>برای مدیریت پروژه‌های زمان‌سنجی وارد حساب کاربری خود شوید.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="size-4" aria-hidden /> ورود
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5">
                <UserPlus className="size-4" aria-hidden /> ثبت‌نام
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={submitLogin} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="login-email">رایانامه</Label>
                  <Input
                    id="login-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">گذرواژه</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={login.isPending}>
                  {login.isPending && <Spinner />} ورود
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={submitRegister} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="reg-name">نام و نام خانوادگی</Label>
                  <Input
                    id="reg-name"
                    autoComplete="name"
                    value={regForm.name}
                    onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">رایانامه</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={regForm.email}
                    onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">گذرواژه (حداقل ۸ نویسه)</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    value={regForm.password}
                    onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={register.isPending || login.isPending}>
                  {register.isPending && <Spinner />} ساخت حساب و ورود
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-4 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">یا</span>
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
            onClick={demoLogin}
            disabled={login.isPending}
          >
            {login.isPending ? <Spinner /> : <GraduationCap className="size-4" aria-hidden />}
            ورود به حساب نمونه آموزشی
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            حساب نمونه شامل یک پروژه آموزشی ایزوله است که وارد نتایج پروژه‌های واقعی نمی‌شود.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
