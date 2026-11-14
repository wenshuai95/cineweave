"""桥接公共库：three.js → Blender 坐标、关键帧采样（与工具 model.mjs 同语义）。

工程坐标系：three.js（Y 向上，右手）
Blender 坐标系：Z 向上（右手）
映射：position_b = (x, -z, y)，旋转四元数 q_b = Q ⊗ q_t ⊗ Q⁻¹，Q = 绕 X 轴 +90°。
"""
import math
from mathutils import Euler, Quaternion, Vector

# three.js Y-up → Blender Z-up
Q_UP = Quaternion((1.0, 0.0, 0.0), math.radians(90.0))
Q_UP_INV = Q_UP.inverted()


def pos_to_blender(p):
    """three.js [x, y, z] → Blender (x, -z, y)。"""
    x, y, z = (float(v) for v in p)
    return Vector((x, -z, y))


def three_euler_to_quat(rx_deg, ry_deg, rz_deg):
    """按 three.js Euler('XYZ') 约定构造四元数，再换到 Blender 基底。"""
    e = Euler((math.radians(rx_deg), math.radians(ry_deg), math.radians(rz_deg)), 'XYZ')
    q_t = e.to_quaternion()
    return (Q_UP @ q_t @ Q_UP_INV).normalized()


def hex_to_linear(hex_color, fallback=(0.72, 0.72, 0.72)):
    """sRGB hex → Blender 线性 RGBA。"""
    try:
        h = hex_color.lstrip('#')
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    except Exception:
        rgb = list(fallback)
    def srgb_to_linear(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(srgb_to_linear(c) for c in rgb) + (1.0,)


# ---------------------------------------------------------------- sampling
def _lerp(a, b, u):
    return a + (b - a) * u


def _ease_u(u, ease):
    if ease == 'hold':
        return 0.0
    if ease == 'linear':
        return u
    return u * u * (3 - 2 * u)  # smooth


def _sample_keys(keys, t):
    """返回 (a, b, u)：a 为当前段起点关键帧，b 为终点，u 为缓动后插值系数。"""
    keys = sorted(keys, key=lambda k: k['t'])
    if not keys:
        return None, None, 0.0
    if t <= keys[0]['t']:
        return keys[0], keys[0], 0.0
    if t >= keys[-1]['t']:
        return keys[-1], keys[-1], 0.0
    for i in range(1, len(keys)):
        if keys[i]['t'] > t:
            a, b = keys[i - 1], keys[i]
            u = (t - a['t']) / (b['t'] - a['t']) if b['t'] > a['t'] else 0.0
            return a, b, _ease_u(u, a.get('ease', 'smooth'))
    return keys[-1], keys[-1], 0.0


def _field(a, b, u, name, default):
    av = a.get(name, default) if a else default
    bv = b.get(name, default) if b else default
    return _lerp(av, bv, u)


def _vec_field(a, b, u, name, default):
    av = a.get(name, default) if a else default
    bv = b.get(name, default) if b else default
    return [_lerp(av[i], bv[i], u) for i in range(len(default))]


def sample_object(o, t):
    """采样模型对象：位置/旋转/缩放/颜色/动作片段（对齐工具 sampleObject）。"""
    a, b, u = _sample_keys(o.get('keys') or [], t)
    if a is None:
        state = {
            'position': o.get('position', [0, 0, 0]),
            'rotation': o.get('rotation', 0),
            'rotationX': o.get('rotationX', 0),
            'rotationZ': o.get('rotationZ', 0),
            'scale': o.get('scale', 1),
        }
    else:
        state = {
            'position': _vec_field(a, b, u, 'position', [0, 0, 0]),
            'rotation': _field(a, b, u, 'rotation', o.get('rotation', 0)),
            'rotationX': _field(a, b, u, 'rotationX', o.get('rotationX', 0)),
            'rotationZ': _field(a, b, u, 'rotationZ', o.get('rotationZ', 0)),
            'scale': _field(a, b, u, 'scale', o.get('scale', 1)),
        }
    # 独立通道（新格式）覆盖旧 keys
    for name, keys in (o.get('channels') or {}).items():
        if not keys:
            continue
        ca, cb, cu = _sample_keys(keys, t)
        val = ca['value'] if cu == 0.0 and ca is cb else _lerp(ca['value'], cb['value'], cu)
        if name.startswith('position'):
            state['position'][{'positionX': 0, 'positionY': 1, 'positionZ': 2}[name]] = val
        elif name in ('rotation', 'rotationX', 'rotationZ', 'scale'):
            state[name] = val
        elif name == 'modelTint':
            state['modelTint'] = ca['value']
    # 动画片段（角色动作）
    active = None
    for act in o.get('actions') or []:
        if act.get('start', 0) <= t < act.get('end', 0):
            active = act
            break
    if active:
        clip = active.get('clip') or o.get('modelClip') or ''
        if active.get('mode') == 'hold':
            at = active.get('holdTime', 0)
        else:
            at = (t - active.get('start', 0)) * active.get('speed', 1)
    else:
        clip = o.get('modelClip') or ''
        at = t
    state['modelClip'] = clip
    state['actionTime'] = at
    state['modelTint'] = o.get('tint', '#b8b8b8')
    return state


def sample_camera(cam, t):
    a, b, u = _sample_keys(cam.get('keys') or [], t)
    if a is None:
        return {
            'position': cam.get('position', [0, 2, 8]),
            'target': cam.get('target', [0, 1, 0]),
            'fov': cam.get('fov', 45),
            'roll': cam.get('roll', 0),
        }
    roll = a.get('roll', 0) if a is b else _lerp(a.get('roll', 0), b.get('roll', 0), u)
    return {
        'position': _vec_field(a, b, u, 'position', cam.get('position', [0, 2, 8])),
        'target': _vec_field(a, b, u, 'target', cam.get('target', [0, 1, 0])),
        'fov': _field(a, b, u, 'fov', cam.get('fov', 45)),
        'roll': roll,
    }


def camera_transform(pos3, target3, roll_deg):
    """返回 Blender (位置 Vector, 旋转四元数)。"""
    p = pos_to_blender(pos3)
    tgt = pos_to_blender(target3)
    q = (tgt - p).to_track_quat('-Z', 'Y')
    if roll_deg:
        q = q @ Quaternion((0.0, 0.0, 1.0), math.radians(roll_deg))
    return p, q
