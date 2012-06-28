attribute float aS;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform float uTime;

varying vec4 vColor;

void main(void) {
  float s = aS;
  float t = uTime;
  gl_Position = uPMatrix * uMVMatrix * vec4(FX, FY, FZ, 1.0);
  vColor = vec4(FR, FG, FB, 1.0);
}
