#!/usr/bin/env python3
"""
ONNX 模型一键优化：简化 + FP16 + (可选)INT8
"""
import os
import onnx
from onnxsim import simplify
from onnxconverter_common import float16

INPUT  = "/home/suchang/sanghuang-detector/model/model.onnx"
OUT_SIM  = "/home/suchang/sanghuang-detector/model/model_sim.onnx"
OUT_FP16 = "/home/suchang/sanghuang-detector/model/model_fp16.onnx"
OUT_INT8 = "/home/suchang/sanghuang-detector/model/model_int8.onnx"

def mb(path):
    return os.path.getsize(path) / (1024 * 1024)

# ---------- 1. 简化 ----------
print(f"[0] 原始模型: {mb(INPUT):.2f} MB")
print("[1] 简化计算图...")
model = onnx.load(INPUT)
model_sim, check = simplify(model)
assert check, "simplify 校验失败"
onnx.save(model_sim, OUT_SIM)
print(f"    -> {mb(OUT_SIM):.2f} MB")

# ---------- 2. FP16 ----------
print("[2] 转 FP16...")
model_fp16 = float16.convert_float_to_float16(
    onnx.load(OUT_SIM),
    keep_io_types=True,          # 输入输出仍是 FP32，兼容性好
    disable_shape_infer=False,
)
onnx.save(model_fp16, OUT_FP16)
print(f"    -> {mb(OUT_FP16):.2f} MB")

# ---------- 3. INT8 动态量化（可选，体积最小） ----------
print("[3] INT8 动态量化...")
try:
    from onnxruntime.quantization import quantize_dynamic, QuantType
    quantize_dynamic(
        model_input=OUT_SIM,
        model_output=OUT_INT8,
        weight_type=QuantType.QUInt8,
        per_channel=True,
    )
    print(f"    -> {mb(OUT_INT8):.2f} MB")
except ImportError:
    print("    跳过（请先 pip install onnxruntime）")

# ---------- 汇总 ----------
print("\n========== 汇总 ==========")
print(f"原始 FP32 : {mb(INPUT):.2f} MB")
print(f"简化 FP32 : {mb(OUT_SIM):.2f} MB")
print(f"FP16      : {mb(OUT_FP16):.2f} MB  (推荐用于 GPU)")
if os.path.exists(OUT_INT8):
    print(f"INT8      : {mb(OUT_INT8):.2f} MB  (推荐用于 CPU)")
