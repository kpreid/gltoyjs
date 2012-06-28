attribute float aS;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform float uTime;

varying vec4 vColor;

// --- Definitions for F functions ---
const float PI = 3.1415926;
float sec(float x) { return 1.0 / cos(x); }
float round(float x) { return floor(x + 0.5) - 0.5; }

#define APPLY(variable, parameter, function) { float p = float(parameter); variable = (function); }

void main(void) {
  float s = aS;
  float t = uTime;
  float p = 0.5;
  float ess = s * PI * p * 48.0;
  float esst = ess + t;

  vec4 position;
  APPLY(position.x, PX, FX)
  APPLY(position.y, PY, FY)
  APPLY(position.z, PZ, FZ)
  position.w = 1.0;
  APPLY(vColor.r, PR, FR)
  APPLY(vColor.g, PG, FG)
  APPLY(vColor.b, PB, FB)
  vColor.a = 1.0;
  
  gl_Position = uPMatrix * uMVMatrix * position;
}
