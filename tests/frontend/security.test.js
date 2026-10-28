const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');
test('CAPTCHA config failure is retryable and follows the configured API origin',async()=>{
 let calls=0;const c={AbortSignal,document:{addEventListener(){}},
  BARBER_HUB_API_BASE_URL:'https://api.example.test/api/v1/',
  fetch:async url=>{assert.equal(url,'https://api.example.test/api/v1/public-config');
   if(++calls===1)return {ok:false};
   return {ok:true,json:async()=>({success:true,data:{turnstile_site_key:'',captcha_required:false}})};
  }};c.window=c;vm.runInNewContext(fs.readFileSync('js/security.js','utf8'),c);
 await assert.rejects(c.bhSecurity.token({}),/proteção de acesso/);
 assert.equal(await c.bhSecurity.token({}),undefined);assert.equal(calls,2);
});
