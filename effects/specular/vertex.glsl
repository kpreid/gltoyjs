attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform vec3 uColor;

varying vec3 vNormal;
varying vec3 vColor;

void main(void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aPosition, 1.0);
  vColor = uColor;
  vNormal = mat3(uMVMatrix) * aNormal;
}
