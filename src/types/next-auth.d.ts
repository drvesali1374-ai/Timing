import type { DefaultSession, DefaultUser } from "next-auth";

/** افزودن id کاربر به تایپ نشست (NextAuth v4 module augmentation). */
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & DefaultUser & {
      id: string;
    };
  }
}
