attribute vec3 aPosition;
attribute vec3 aNormal;
attribute float aRepeatAngle;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

uniform mat4 uChainMatrix;
uniform vec3 uColor;

varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;

mat4 rotmat(float angle) {
  return mat4(
    cos(angle), sin(angle), 0, 0,
    -sin(angle), cos(angle), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
}

void main(void) {
  mat4 completeMV = uMVMatrix * rotmat(aRepeatAngle) * uChainMatrix;
  gl_Position = completeMV * vec4(aPosition, 1.0);
  vColor = uColor;
  vNormal = normalize(mat3(completeMV) * aNormal);
  vPosition = vec3(gl_Position); // TODO this should be in model space, excluding the viewDistance and transition
  gl_Position = uPMatrix * gl_Position;
}
