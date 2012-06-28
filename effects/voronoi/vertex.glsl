attribute vec3 aVertexPosition;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform vec4 uColor;

varying vec4 vColor;
varying vec4 vP;

void main(void) {
  vP = uMVMatrix * vec4(aVertexPosition, 1.0);
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  vColor = uColor;
}
