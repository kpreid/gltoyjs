attribute float aS;
#if SPARK
attribute vec2 aSparkCoord;
#endif

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform float uTime;

varying vec4 vColor;
varying vec2 vSparkCoord;

// --- Definitions for F functions ---
const float PI = 3.1415926;
float sec(float x) { return 1.0 / cos(x); }
float round(float x) { return floor(x + 0.5) - 0.5; }
float t = uTime;

#define APPLY1(variable, parameter, function) { float p = float(parameter); float ess = s * PI * p * 48.0; float esst = ess + t; variable = (function); }

vec3 position(float s) {
  vec3 pos;
  APPLY1(pos.x, PX, FX)
  APPLY1(pos.y, PY, FY)
  APPLY1(pos.z, PZ, FZ)
  return pos;
}

void main(void) {
#if SPARK
  float s = mod(aS + float(SPARK_SPEED) * uTime, 1.0);
#else
  float s = aS;
#endif
  
  vec3 pos0 = position(s);
  gl_Position = uMVMatrix * vec4(pos0, 1.0);
  
  vec3 tangent = position(s + 0.001) - pos0;
  
#if SPARK
  gl_Position.xyz += float(SPARK_SCALE) * aSparkCoord.t * normalize(cross(vec3(0.0, 0.0, 1.0), mat3(uMVMatrix) * tangent));
#endif

  gl_Position = uPMatrix * gl_Position;
  
#if SPARK
  vColor = vec4(1.0);
  vSparkCoord = aSparkCoord;
#else
  APPLY1(vColor.r, PR, FR)
  APPLY1(vColor.g, PG, FG)
  APPLY1(vColor.b, PB, FB)
  vColor.a = 1.0;
  vSparkCoord = vec2(0.5, 0.0);
#endif
}
