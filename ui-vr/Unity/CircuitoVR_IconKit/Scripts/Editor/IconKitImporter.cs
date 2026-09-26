using System.IO;
using UnityEditor;
using UnityEngine;

namespace CircuitoVR.IconKit.EditorTools
{
    /// <summary>
    /// Configura automaticamente as texturas do kit na primeira importação:
    /// Sprite (2D and UI), alpha como transparência, mipmaps (evita cintilação no VR),
    /// clamp e as bordas de 9-slice das placas. Depois disso, o que você mudar no
    /// Inspector é mantido.
    /// </summary>
    public class IconKitImporter : AssetPostprocessor
    {
        const string Root = "CircuitoVR_IconKit/Sprites/";

        void OnPreprocessTexture()
        {
            string path = assetPath.Replace('\\', '/');
            if (!path.Contains(Root) || !assetImporter.importSettingsMissing) return;

            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Sprite;
            ti.spriteImportMode = SpriteImportMode.Single;
            ti.alphaSource = TextureImporterAlphaSource.FromInput;
            ti.alphaIsTransparency = true;
            ti.mipmapEnabled = true;
            ti.mipmapFilter = TextureImporterMipFilter.KaiserFilter;
            ti.wrapMode = TextureWrapMode.Clamp;
            ti.filterMode = FilterMode.Trilinear;
            ti.anisoLevel = 4;
            ti.sRGBTexture = true;
            ti.textureCompression = TextureImporterCompression.CompressedHQ;
            ti.spritePixelsPerUnit = 100;

            string file = Path.GetFileNameWithoutExtension(path);
            if (path.Contains("/HoverSheets/"))
            {
                // Flipbook 4x4 lido por RawImage.uvRect (cada quadro tem margem transparente,
                // então os mips não misturam quadros vizinhos de forma visível).
                ti.maxTextureSize = 1024;
            }
            else if (path.Contains("/Plates/"))
            {
                ti.maxTextureSize = 512;
                ti.spriteBorder = BorderFor(file);
            }
            else
            {
                ti.maxTextureSize = 512;
            }
        }

        // Margem do halo + raio do canto (ver src/plates.js, KINDS).
        static Vector4 BorderFor(string file)
        {
            float b = file.StartsWith("square_") ? 148
                : file.StartsWith("pill_") ? 104
                : file.StartsWith("card_") ? 100
                : file.StartsWith("badge_") ? 56
                : 0;
            return new Vector4(b, b, b, b);
        }
    }
}
