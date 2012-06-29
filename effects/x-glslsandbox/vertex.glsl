attribute vec3 aPosition;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec2 surfacePosition;

void main(void) {
  surfacePosition = aPosition.xy;
  gl_Position = uPMatrix * uMVMatrix * vec4(aPosition, 1.0);
}
