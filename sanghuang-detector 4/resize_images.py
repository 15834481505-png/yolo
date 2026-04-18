#!/usr/bin/env python3
"""
图片尺寸转换工具
将任意尺寸的图片转换为 640x640 尺寸，保持比例，不修剪
放在 /home/suchang/sanghuang-detector/ 目录下运行
"""
import os
import argparse
from PIL import Image
import glob

def resize_image(input_path, output_path, target_size=640):
    """
    调整图片尺寸为 target_size x target_size，保持比例，不修剪
    
    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径
        target_size: 目标尺寸，默认 640
    """
    try:
        # 打开图片
        img = Image.open(input_path)
        
        # 保持比例调整图片大小
        img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
        
        # 创建 640x640 的画布，背景为黑色
        new_img = Image.new('RGB', (target_size, target_size), (0, 0, 0))
        
        # 计算居中位置
        left = (target_size - img.width) // 2
        top = (target_size - img.height) // 2
        
        # 将调整后的图片粘贴到画布中央
        new_img.paste(img, (left, top))
        
        # 保存结果
        new_img.save(output_path)
        
        print(f"✅ 转换成功: {input_path} -> {output_path}")
        print(f"   原始尺寸: {img.width}x{img.height} -> 新尺寸: 640x640")
        return True
    except Exception as e:
        print(f"❌ 转换失败: {input_path}")
        print(f"   错误: {e}")
        return False

def batch_resize(input_dir, output_dir, target_size=640):
    """
    批量处理目录中的所有图片
    
    Args:
        input_dir: 输入目录
        output_dir: 输出目录
        target_size: 目标尺寸，默认 640
    """
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    # 支持的图片格式
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.webp']
    
    total = 0
    success = 0
    
    for ext in image_extensions:
        for img_path in glob.glob(os.path.join(input_dir, ext)):
            total += 1
            filename = os.path.basename(img_path)
            output_path = os.path.join(output_dir, filename)
            if resize_image(img_path, output_path, target_size):
                success += 1
    
    print(f"\n📊 处理完成: {success}/{total} 张图片成功转换")

def main():
    parser = argparse.ArgumentParser(description='将图片转换为 640x640 尺寸')
    
    parser.add_argument('--input', '-i', required=True, help='输入图片路径或目录')
    parser.add_argument('--output', '-o', required=True, help='输出图片路径或目录')
    parser.add_argument('--size', '-s', type=int, default=640, help='目标尺寸，默认 640')
    
    args = parser.parse_args()
    
    if os.path.isfile(args.input):
        # 处理单个文件
        if os.path.isdir(args.output):
            # 如果输出是目录，使用输入文件名
            output_path = os.path.join(args.output, os.path.basename(args.input))
        else:
            output_path = args.output
        
        resize_image(args.input, output_path, args.size)
    
    elif os.path.isdir(args.input):
        # 处理目录
        batch_resize(args.input, args.output, args.size)
    else:
        print(f"❌ 输入路径不存在: {args.input}")

if __name__ == "__main__":
    main()
