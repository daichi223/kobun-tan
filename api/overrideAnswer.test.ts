import { describe, it, expect, vi, beforeEach } from "vitest";

// --- thin mock for Firestore Admin ---
class Doc {
  dataObj: any;
  constructor(public id: string, data: any) { this.dataObj = data; }
  get() { return Promise.resolve({ exists: !!this.dataObj, data: () => this.dataObj }); }
  update(p: any){ Object.assign(this.dataObj, p); return Promise.resolve(); }
  set(p: any){ this.dataObj = p; return Promise.resolve(); }
}
class Collection {
  docs = new Map<string, Doc>();
  doc(id?: string){ const k = id ?? Math.random().toString(36).slice(2); if(!this.docs.has(k)) this.docs.set(k, new Doc(k, null)); return this.docs.get(k)!; }
  add(p:any){ const d = this.doc(); d.set(p); return Promise.resolve({ id: d.id }); }
}
const answers = new Collection();
const overrides = new Collection();
const dbMock = {
  collection: (name:string)=> name==="answers" ? answers : overrides,
  runTransaction: (fn:(tx:any)=>any)=> fn({
    get: (ref:Doc)=> ref.get(),
    update: (ref:Doc,p:any)=> ref.update(p),
    set: (ref:Doc,p:any)=> ref.set(p)
  }),
  batch: ()=>({ update: ()=>{}, commit: ()=>Promise.resolve() }),
  FieldValue: { delete: ()=>({ _delete:true }) }
};

// patch module before import
vi.mock("./_firebaseAdmin", () => ({ db: dbMock }));

import handler from "./overrideAnswer";

const req = (body:any)=>({ method:"POST", body } as any);
const res = ()=>{ const r:any = { code:200, jsonBody:null }; r.status=(c:number)=>{ r.code=c; return r; }; r.json=(b:any)=>{ r.jsonBody=b; return r; }; return r; };

describe("overrideAnswer", () => {
  beforeEach(() => {
    answers.docs.clear(); overrides.docs.clear();
  });

  it("manual override sets final=manual", async () => {
    const a = answers.doc("a1"); await a.set({ raw:{ auto:{ result:"NG", reason:"x" } } });
    const response:any = res();
    await handler(req({ answerId:"a1", result:"OK", actor:"t1" }), response);
    expect(response.code).toBe(200);
    expect(response.jsonBody.final.source).toBe("manual");
    expect(response.jsonBody.final.result).toBe("OK");
  });

  it("revert sets final back to auto", async () => {
    const a = answers.doc("a2"); await a.set({ raw:{ auto:{ result:"OK", reason:"hi" } }, manual:{ result:"NG" } });
    const response:any = res();
    await handler(req({ answerId:"a2", result:null, actor:"t1" }), response);
    expect(response.jsonBody.final.source).toBe("auto");
    expect(response.jsonBody.final.result).toBe("OK");
  });
});
