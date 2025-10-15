// api/_requireStaff.ts
import { getAuth } from "firebase-admin/auth";

/**
 * 共有トークン or 教師ログインのどちらかで通す。
 * 戻り値 actor は監査ログに使う。
 */
export async function requireStaff(req: any): Promise<{ actor: string }> {
  const tokenEnv = process.env.ADMIN_VIEW_TOKEN;
  // A) 共有トークン（推奨ヘッダ: x-admin-token。無ければ ?token= も許可）
  const headerTok = req.headers?.["x-admin-token"] || req.headers?.["X-Admin-Token"];
  const queryTok = (req.query && (req.query.token as string)) || undefined;
  const token = (headerTok || queryTok)?.toString();
  if (tokenEnv && token && token === tokenEnv) {
    return { actor: "admin-token" };
  }

  // B) 既存の教師ログイン（任意）：Authorization: Bearer <Firebase ID token>
  const auth = (req.headers?.authorization || "").split(" ");
  if (auth[0] === "Bearer" && auth[1]) {
    try {
      const decoded = await getAuth().verifyIdToken(auth[1], true);
      const role = (decoded as any).role || (decoded as any)["https://claims.example/role"];
      if (role === "teacher") return { actor: decoded.email || decoded.uid };
    } catch (e) {
      // Invalid token, fall through to error
    }
  }

  throw new Error("PERMISSION_DENIED");
}
