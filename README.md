# Image Deck

Image Deck renders an `image-deck` fenced code block as a large image with a horizontally scrollable thumbnail strip.

## Usage

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

Available block options are `height`, `fit` (`contain` or `cover`), `loop`, `captions`, `thumbnailSize`, `start`, `controls`, and `openOnClick`.

Use the arrow buttons, keyboard Left/Right/Home/End keys, thumbnail buttons, or a horizontal swipe on mobile to change images. Clicking the main image opens the corresponding Vault file by default.
