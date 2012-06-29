attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform vec3 uColor;

varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;

void main(void) {
  gl_Position = uMVMatrix * vec4(aPosition, 1.0);
  vColor = uColor;
  vNormal = aNormal;
  vPosition = vec3(gl_Position); // TODO this should be in model space, excluding the viewDistance and transition
  gl_Position = uPMatrix * gl_Position;
}
