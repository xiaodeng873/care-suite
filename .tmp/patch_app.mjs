import fs from 'fs';
const f = 'apps/web/src/App.tsx';
let s = fs.readFileSync(f, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
let n = 0;

// FacilityScoped 組件（放在 App() 之前）
let oldStr = "function App() {";
let newStr = [
"// 以當前院舍 id 做 key：切換院舍時整棵資料樹（所有 Context）重掛，",
"// 強制用新 dbToken 重新載入，杜絕閘門/登入階段用無指定 token 載入嘅舊院舍資料殘留",
"function FacilityScoped({ children }: { children: React.ReactNode }) {",
"  const { dbFacilityId } = useAuth();",
"  return <React.Fragment key={dbFacilityId ?? 'ops'}>{children}</React.Fragment>;",
"}",
"",
"function App() {",
].join(eol);
if (!s.includes(oldStr)) throw new Error('App anchor not found');
s = s.replace(oldStr, newStr); n++;

// 用 FacilityScoped 包住 ThemeProvider 至 AppContent
oldStr = [
"        <AuthProvider>",
"          <ThemeProvider>",
].join(eol);
newStr = [
"        <AuthProvider>",
"          <FacilityScoped>",
"          <ThemeProvider>",
].join(eol);
if (!s.includes(oldStr)) throw new Error('open anchor not found');
s = s.replace(oldStr, newStr); n++;

oldStr = [
"                        </CgatProvider>",
"                      </PatientFilterProvider>",
"                    </PatientProvider>",
"                  </RecordsProvider>",
"                </WorkflowProvider>",
"              </MedicalProvider>",
"            </StationFilterProvider>",
"          </StationProvider>",
"          </ThemeProvider>",
"        </AuthProvider>",
].join(eol);
newStr = [
"                        </CgatProvider>",
"                      </PatientFilterProvider>",
"                    </PatientProvider>",
"                  </RecordsProvider>",
"                </WorkflowProvider>",
"              </MedicalProvider>",
"            </StationFilterProvider>",
"          </StationProvider>",
"          </ThemeProvider>",
"          </FacilityScoped>",
"        </AuthProvider>",
].join(eol);
if (!s.includes(oldStr)) throw new Error('close anchor not found');
s = s.replace(oldStr, newStr); n++;

fs.writeFileSync(f, s);
console.log('patched', n, 'spots');
