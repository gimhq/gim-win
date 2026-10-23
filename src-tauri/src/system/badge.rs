//! The unread badge: a 16x16 RGBA overlay (red disc, white count) drawn in
//! pure Rust and set as the taskbar overlay icon on Windows.

// The renderer is only called by the Windows overlay (and the tests).
#![cfg_attr(not(windows), allow(dead_code))]

use tauri::AppHandle;
#[cfg(windows)]
use tauri::Manager;

use super::SystemError;

/// Side of the square badge image, in pixels.
pub const BADGE_SIZE: u32 = 16;

const RED: [u8; 4] = [0xE5, 0x39, 0x35, 0xFF];
const WHITE: [u8; 4] = [0xFF, 0xFF, 0xFF, 0xFF];
const GLYPH_W: u32 = 3;
const GLYPH_H: u32 = 5;

/// The text on the badge: none for 0, the digit up to 9, "9+" beyond.
pub fn badge_label(count: u32) -> Option<String> {
    match count {
        0 => None,
        1..=9 => Some(count.to_string()),
        _ => Some("9+".to_string()),
    }
}

/// A 3x5 bitmap glyph, one row per entry, bit 2 is the left column.
fn glyph(c: char) -> [u8; 5] {
    match c {
        '0' => [0b111, 0b101, 0b101, 0b101, 0b111],
        '1' => [0b010, 0b110, 0b010, 0b010, 0b111],
        '2' => [0b111, 0b001, 0b111, 0b100, 0b111],
        '3' => [0b111, 0b001, 0b111, 0b001, 0b111],
        '4' => [0b101, 0b101, 0b111, 0b001, 0b001],
        '5' => [0b111, 0b100, 0b111, 0b001, 0b111],
        '6' => [0b111, 0b100, 0b111, 0b101, 0b111],
        '7' => [0b111, 0b001, 0b001, 0b001, 0b001],
        '8' => [0b111, 0b101, 0b111, 0b101, 0b111],
        '9' => [0b111, 0b101, 0b111, 0b001, 0b111],
        '+' => [0b000, 0b010, 0b111, 0b010, 0b000],
        _ => [0; 5],
    }
}

/// Draws `label` in white on a filled red disc; returns the RGBA bytes,
/// width and height (`BADGE_SIZE` square).
pub fn render_badge(label: &str) -> (Vec<u8>, u32, u32) {
    let size = BADGE_SIZE;
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let centre = size as f32 / 2.0;
    let radius = centre;
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 + 0.5 - centre;
            let dy = y as f32 + 0.5 - centre;
            if dx * dx + dy * dy <= radius * radius {
                let i = ((y * size + x) * 4) as usize;
                rgba[i..i + 4].copy_from_slice(&RED);
            }
        }
    }
    let chars: Vec<char> = label.chars().collect();
    if chars.is_empty() {
        return (rgba, size, size);
    }
    let text_w = chars.len() as u32 * GLYPH_W + (chars.len() as u32 - 1);
    let x0 = size.saturating_sub(text_w) / 2;
    let y0 = (size - GLYPH_H) / 2;
    for (n, c) in chars.iter().enumerate() {
        let rows = glyph(*c);
        let gx = x0 + n as u32 * (GLYPH_W + 1);
        for (row, bits) in rows.iter().enumerate() {
            for col in 0..GLYPH_W {
                if bits & (1 << (GLYPH_W - 1 - col)) == 0 {
                    continue;
                }
                let (x, y) = (gx + col, y0 + row as u32);
                if x < size && y < size {
                    let i = ((y * size + x) * 4) as usize;
                    rgba[i..i + 4].copy_from_slice(&WHITE);
                }
            }
        }
    }
    (rgba, size, size)
}

/// Sets the taskbar overlay badge of the main window (Windows only).
#[tauri::command]
pub fn set_badge_count(app: AppHandle, count: u32) -> Result<(), SystemError> {
    let label = badge_label(count);
    set_overlay(&app, label)
}

#[cfg(windows)]
fn set_overlay(app: &AppHandle, label: Option<String>) -> Result<(), SystemError> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| SystemError::internal("main window not found"))?;
    let icon = label.map(|l| {
        let (rgba, w, h) = render_badge(&l);
        tauri::image::Image::new_owned(rgba, w, h)
    });
    window.set_overlay_icon(icon)?;
    Ok(())
}

#[cfg(not(windows))]
fn set_overlay(_app: &AppHandle, _label: Option<String>) -> Result<(), SystemError> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn label_clamps() {
        assert_eq!(badge_label(0), None);
        assert_eq!(badge_label(1).as_deref(), Some("1"));
        assert_eq!(badge_label(9).as_deref(), Some("9"));
        assert_eq!(badge_label(10).as_deref(), Some("9+"));
        assert_eq!(badge_label(250).as_deref(), Some("9+"));
    }

    fn pixels(rgba: &[u8]) -> impl Iterator<Item = &[u8]> {
        rgba.chunks(4)
    }

    #[test]
    fn render_has_the_size_and_red_and_white_pixels() {
        let (rgba, w, h) = render_badge("9+");
        assert_eq!((w, h), (BADGE_SIZE, BADGE_SIZE));
        assert_eq!(rgba.len(), (BADGE_SIZE * BADGE_SIZE * 4) as usize);
        assert!(pixels(&rgba).any(|p| p == RED));
        assert!(pixels(&rgba).any(|p| p == WHITE));
        // The corners stay transparent outside the disc.
        assert_eq!(&rgba[..4], &[0, 0, 0, 0]);
    }

    #[test]
    fn digits_render_differently() {
        assert_ne!(render_badge("1").0, render_badge("2").0);
        assert_ne!(render_badge("9").0, render_badge("9+").0);
    }
}
