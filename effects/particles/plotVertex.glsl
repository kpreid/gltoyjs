attribute vec2 aTexCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform sampler2D uState;
uniform float uResolution;
uniform float uPointSize;

varying vec3 vColor;

void main(void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(
    texture2D(uState, aTexCoord).xyz,
    1.0
  );
  gl_PointSize = uPointSize;
  vColor = vec3(0.5) + 0.5 * abs(texture2D(uState, aTexCoord + vec2(1.0/uResolution, 0.0)).rgb);
}
