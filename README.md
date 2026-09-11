# Image Deck

Image Deck renders an `image-deck` fenced code block as a large image with a horizontally scrollable thumbnail strip.

Image Deckは、`image-deck`コードブロックを、大きな画像と横スクロールできるサムネイル一覧として表示します。

## Usage / 使い方

````markdown
```image-deck
height: 480px
fit: contain
loop: true
captions: true

![[photo-01.jpg|First photo]]
![[Attachments/photo-02.webp|Second photo]]
https://example.com/photo-03.jpg
```
````

Vault links, plain Vault paths, Markdown images, and HTTP(S) image URLs are supported. The options section is optional and must appear before the first image. Separate it from the images with a blank line.

Vault内のリンク、通常のVault内パス、Markdown形式の画像、HTTP(S)の画像URLに対応しています。オプションは省略できます。指定する場合は最初の画像より前に記述し、画像との間に空行を入れてください。

Available block options are `height`, `fit` (`contain` or `cover`), `loop`, `captions`, `thumbnailSize`, `start`, `controls`, and `openOnClick`.

指定できるオプションは、`height`（高さ）、`fit`（画像全体を収める `contain` または枠を埋める `cover`）、`loop`（循環表示）、`captions`（キャプション表示）、`thumbnailSize`（サムネイルのサイズ）、`start`（最初に表示する画像番号・1から開始）、`controls`（前後移動ボタンの表示）、`openOnClick`（クリックで画像を開く）です。

For `height`, a number without a unit is treated as pixels (e.g. `height: 480`). CSS values such as `480px`, `60vh`, and `auto` are also supported.

`height`は数字だけで指定でき、ピクセル単位として扱われます（例：`height: 480`）。`480px`、`60vh`、`auto`などのCSS値にも対応しています。

Use the arrow buttons, keyboard Left/Right/Home/End keys, thumbnail buttons, or a horizontal swipe on mobile to change images. Clicking the main image opens the corresponding Vault file by default.

画像は、矢印ボタン、キーボードの左右矢印・Home・Endキー、サムネイルのクリック、モバイルでの左右スワイプで切り替えられます。既定では、メイン画像をクリックすると対応するVault内のファイルを開きます。
