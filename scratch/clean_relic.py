"""
Скрипт очистки и нарезки пиксель-арт спрайтов Навыков (Реликвий / Джокеров).
Удаляет зелёный хромакей-фон #00FF00 с помощью умного краевого flood-fill (защищает внутренние зелёные пиксели),
выполняет дефринжинг зелёного ореола, центрирует арт и сохраняет в WebP и PNG.
"""

import os
import sys
from collections import deque
from PIL import Image

# Допустимые отклонения для зелёного фона хромакея
def is_chroma_green(r, g, b, a=255):
    if a < 32:
        return True
    # Ярко-зелёный экран: зелёный доминирует над красным и синим
    return g > 150 and r < 110 and b < 110 and (g - max(r, b)) > 60

def clean_relic_sprite(input_path: str, output_webp: str, output_png: str, target_size=(256, 256)):
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size
    pixels = img.load()

    # Маска посещённых пикселей для flood-fill снаружи
    visited = [[False for _ in range(height)] for _ in range(width)]
    queue = deque()

    # Добавляем все граничные пиксели в очередь, если они зелёные
    for x in range(width):
        for y in [0, height - 1]:
            r, g, b, a = pixels[x, y]
            if is_chroma_green(r, g, b, a):
                queue.append((x, y))
                visited[x][y] = True

    for y in range(height):
        for x in [0, width - 1]:
            if not visited[x][y]:
                r, g, b, a = pixels[x, y]
                if is_chroma_green(r, g, b, a):
                    queue.append((x, y))
                    visited[x][y] = True

    # 4-связный BFS обход зелёного фона от краев к центру
    while queue:
        cx, cy = queue.popleft()
        pixels[cx, cy] = (0, 0, 0, 0)  # делаем прозрачным

        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height and not visited[nx][ny]:
                r, g, b, a = pixels[nx, ny]
                if is_chroma_green(r, g, b, a):
                    visited[nx][ny] = True
                    queue.append((nx, ny))

    # Дефринжинг: подавление зелёного ореола на полупрозрачных границах
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # Если соседние пиксели прозрачные, проверяем паразитный зелёный оттенок
                has_transparent_neighbor = False
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and visited[nx][ny]:
                        has_transparent_neighbor = True
                        break
                if has_transparent_neighbor and g > max(r, b) and (g - max(r, b)) > 20:
                    avg_rb = (r + b) // 2
                    pixels[x, y] = (r, min(g, avg_rb + 15), b, a)

    # Находим ограничивающий прямоугольник (bbox) непрозрачного объекта
    bbox = img.getbbox()
    if bbox:
        cropped = img.crop(bbox)
        # Центрируем внутри квадратного холста target_size с сохранением пропорций
        obj_w, obj_h = cropped.size
        scale = min(target_size[0] / obj_w, target_size[1] / obj_h) * 0.90
        new_w = max(1, int(obj_w * scale))
        new_h = max(1, int(obj_h * scale))

        # Pixel-art масштабирование без сглаживания (NEAREST)
        resized = cropped.resize((new_w, new_h), Image.Resampling.NEAREST)

        canvas = Image.new('RGBA', target_size, (0, 0, 0, 0))
        offset_x = (target_size[0] - new_w) // 2
        offset_y = (target_size[1] - new_h) // 2
        canvas.paste(resized, (offset_x, offset_y), resized)
        final_img = canvas
    else:
        final_img = img

    # Создаём выходные папки при необходимости
    os.makedirs(os.path.dirname(output_webp), exist_ok=True)
    os.makedirs(os.path.dirname(output_png), exist_ok=True)

    final_img.save(output_webp, 'WEBP', quality=95)
    final_img.save(output_png, 'PNG')
    print(f"Готово: {output_webp} & {output_png}")

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Использование: python clean_relic.py <input_file> <output_webp> <output_png>")
        sys.exit(1)
    clean_relic_sprite(sys.argv[1], sys.argv[2], sys.argv[3])
