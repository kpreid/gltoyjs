attribute vec2 aTexCoord;
attribute float aLineEnd;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform sampler2D uState;
uniform float uResolution;
uniform float uPointSize;
uniform float uFogStart;
uniform float uFogEnd;

varying vec3 vColor;

vec3 convertHSVToRGB(vec3 hsv) {
  // Conversion per http://en.wikipedia.org/wiki/HSL_and_HSV#Converting_to_RGB
  float h = fract(hsv[0]);
  float s = hsv[1];
  float v = hsv[2];
  float c = s * v;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgbp = hp < 1.0 ? vec3(c, x, 0.0) :
              hp < 2.0 ? vec3(x, c, 0.0) :
              hp < 3.0 ? vec3(0.0, c, x) :
              hp < 4.0 ? vec3(0.0, x, c) :
              hp < 5.0 ? vec3(x, 0.0, c) :
                         vec3(c, 0.0, x);
  return rgbp + v - c;
}

void main(void) {
  // Retrieve particle state
  vec4 state1 = texture2D(uState, aTexCoord);
  vec4 state2 = texture2D(uState, aTexCoord + vec2(1.0/uResolution, 0.0));
  // Untangle
  vec3 pos = state1.xyz;
  vec3 vel = state2.xyz;
  float hue = state1.w;
  float saturation = state2.w;
  
  pos += aLineEnd * vel;
  
  vec4 eyePosition = uMVMatrix * vec4(pos, 1.0);
  gl_Position = uPMatrix * eyePosition;
  vColor = convertHSVToRGB(vec3(hue, saturation, 1.0));
  
  // Fog
  vColor = mix(vColor, vec3(0.0), clamp((-eyePosition.z - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0));
  
  // Compute perspective point size
  vec4 projSize = uPMatrix * vec4(uPointSize, 0.0, eyePosition.zw);
  gl_PointSize = projSize.x / projSize.w;
}
