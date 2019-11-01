import { DoubleSide, Euler, Group, Intersection, Material, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Raycaster, Vector3 } from "three";
import { BareBlockMove, Sequence } from "../../src/alg";
import { Twisty } from "../../src/twisty";
import { Cube3D } from "../../src/twisty/3d/cube3D";
import { TAU } from "../../src/twisty/3d/twisty3D";
import { ButtonGrouping, controllerDirection, Status, VRInput } from "./vr-input";

let initialHeight = parseFloat(new URL(location.href).searchParams.get("height") || "1");
if (isNaN(initialHeight)) {
  initialHeight = 1;
}

let initialScale = parseFloat(new URL(location.href).searchParams.get("scale") || "1");
if (isNaN(initialScale)) {
  initialScale = 1;
}

// From `cube3D.ts`
class AxisInfo {
  public stickerMaterial: THREE.MeshBasicMaterial;
  constructor(public side: string, public vector: Vector3, public fromZ: THREE.Euler, public color: number) {
    // TODO: Make sticker material single-sided when cubie base is rendered?
    color = 0xffffff; // override
    this.stickerMaterial = new MeshBasicMaterial({ color, side: DoubleSide });
    this.stickerMaterial.transparent = true;
    this.stickerMaterial.opacity = 0.4;
  }
}
const axesInfo: AxisInfo[] = [
  new AxisInfo("U", new Vector3(0, 1, 0), new Euler(-TAU / 4, 0, 0), 0xffffff),
  new AxisInfo("L", new Vector3(-1, 0, 0), new Euler(0, -TAU / 4, 0), 0xff8800),
  new AxisInfo("F", new Vector3(0, 0, 1), new Euler(0, 0, 0), 0x00ff00),
  new AxisInfo("R", new Vector3(1, 0, 0), new Euler(0, TAU / 4, 0), 0xff0000),
  new AxisInfo("B", new Vector3(0, 0, -1), new Euler(0, TAU / 2, 0), 0x0000ff),
  new AxisInfo("D", new Vector3(0, -1, 0), new Euler(TAU / 4, 0, 0), 0xffff00),
];

export class VRCube {
  public group: Group = new Group();
  private twisty: Twisty;
  private cachedCube3D: Cube3D;
  private controlPlanes: Mesh[] = [];

  // TODO: Separate tracker abstraction for this?
  private resizeInitialDistance: number;
  private resizeInitialScale: number;

  private moveInitialPuzzleQuaternion: Quaternion = new Quaternion();
  private moveInitialControllerQuaternion: Quaternion = new Quaternion();

  private moveLastControllerPosition: Vector3 = new Vector3();
  private moveVelocity: Vector3 = new Vector3(); // TODO: Track elapsed time since last update?

  constructor(private vrInput: VRInput) {
    this.twisty = new Twisty(document.createElement("twisty"), { alg: new Sequence([]) });
    this.cachedCube3D = this.twisty.experimentalGetPlayer().cube3DView.experimentalGetCube3D();
    this.cachedCube3D.experimentalUpdateOptions({ showFoundation: false, showHintStickers: false });
    this.group.add(this.cachedCube3D.experimentalGetCube());

    for (const axis of axesInfo) {
      const controlPlane = new Mesh(new PlaneGeometry(1, 1), axis.stickerMaterial);
      controlPlane.userData.axis = axis;
      controlPlane.position.copy(controlPlane.userData.axis.vector);
      controlPlane.position.multiplyScalar(0.501);
      controlPlane.setRotationFromEuler(controlPlane.userData.axis.fromZ);

      controlPlane.userData.side = axis.side;
      controlPlane.userData.status = [Status.Untargeted, Status.Untargeted];

      this.controlPlanes.push(controlPlane);
      this.group.add(controlPlane);
    }

    this.group.position.copy(new Vector3(0, initialHeight, 0));
    this.setScale(initialScale);

    this.vrInput.addSingleButtonListener({ controllerIdx: 0, buttonIdx: 1 }, this.onPress.bind(this, 0));
    this.vrInput.addSingleButtonListener({ controllerIdx: 1, buttonIdx: 1 }, this.onPress.bind(this, 1));
    // Button 3 is A/X on the Oculus Touch controllers.
    // TODO: Generalize this to multiple platforms.
    // TODO: Implement single-button press.
    this.vrInput.addButtonListener(ButtonGrouping.All, [{ controllerIdx: 0, buttonIdx: 3 }, { controllerIdx: 1, buttonIdx: 3, invert: true }], this.onMoveStart.bind(this, 0), this.onMoveContinued.bind(this, 0));
    this.vrInput.addButtonListener(ButtonGrouping.All, [{ controllerIdx: 0, buttonIdx: 3, invert: true }, { controllerIdx: 1, buttonIdx: 3 }], this.onMoveStart.bind(this, 1), this.onMoveContinued.bind(this, 1));
    this.vrInput.addButtonListener(ButtonGrouping.All, [{ controllerIdx: 0, buttonIdx: 3 }, { controllerIdx: 1, buttonIdx: 3 }], this.onResizeStart.bind(this), this.onResizeContinued.bind(this), this.onResizeEnd.bind(this));
  }

  public update(): void {
    this.group.position.add(this.moveVelocity);
    this.moveVelocity.multiplyScalar(0.99);
    if (this.moveVelocity.length() < 0.001) {
      this.moveVelocity.setScalar(0);
      // TODO: Set a flag to indicate that the puzzle is not moving?
    }
  }

  private setScale(scale: number): void {
    this.group.scale.setScalar(scale);
  }

  private controllerDistance(): number {
    return this.vrInput.controllers[0].position.distanceTo(this.vrInput.controllers[1].position);
  }

  private onResizeStart(): void {
    navigator.getGamepads()[0].hapticActuators[0].pulse(0.2, 75);
    navigator.getGamepads()[1].hapticActuators[0].pulse(0.2, 75);
    this.resizeInitialDistance = this.controllerDistance();
    this.resizeInitialScale = this.group.scale.x;
  }

  private onResizeContinued(): void {
    const newDistance = this.controllerDistance();
    this.setScale(this.resizeInitialScale * newDistance / this.resizeInitialDistance);
  }

  private onResizeEnd(): void {
    navigator.getGamepads()[0].hapticActuators[0].pulse(0.1, 75);
    navigator.getGamepads()[1].hapticActuators[0].pulse(0.1, 75);
  }

  private onMoveStart(controllerIdx: number): void {
    navigator.getGamepads()[controllerIdx].hapticActuators[0].pulse(0.2, 50);
    this.moveInitialPuzzleQuaternion.copy(this.group.quaternion);

    const controller = this.vrInput.controllers[controllerIdx];
    this.moveLastControllerPosition.copy(controller.position);
    this.moveInitialControllerQuaternion.copy(controller.quaternion);
  }

  private onMoveContinued(controllerIdx: number): void {
    const controller = this.vrInput.controllers[controllerIdx];

    this.moveVelocity.copy(controller.position).sub(this.moveLastControllerPosition);
    this.moveLastControllerPosition.copy(controller.position);

    this.group.quaternion.
      copy(this.moveInitialControllerQuaternion).
      inverse().
      premultiply(controller.quaternion).
      multiply(this.moveInitialPuzzleQuaternion);
  }

  private onPress(controllerIdx: number): void {
    const controller = this.vrInput.controllers[controllerIdx];

    const direction = new Vector3().copy(controllerDirection);
    direction.applyQuaternion(controller.quaternion);
    const raycaster = new Raycaster(controller.position, direction);
    const closestIntersection: Intersection | null = ((l) => l.length > 0 ? l[0] : null)(raycaster.intersectObjects(this.controlPlanes));

    if (closestIntersection) {
      ((closestIntersection.object as Mesh).material as Material).opacity = 0.2;
    }

    for (const controlPlane of this.controlPlanes) {
      if (!closestIntersection || controlPlane !== closestIntersection.object) {
        ((controlPlane as Mesh).material as Material).opacity = 0;
      }
    }

    if (closestIntersection) {
      (closestIntersection.object as Mesh).userData.status[controller.userData.controllerNumber] = controller.userData.isSelecting ? Status.Pressed : Status.Targeted;
      const side = closestIntersection.object.userData.side;
      this.twisty.experimentalAddMove(BareBlockMove(side, controllerIdx === 0 ? -1 : 1));
      navigator.getGamepads()[controllerIdx].hapticActuators[0].pulse(0.1, 75);
    }
  }
}
