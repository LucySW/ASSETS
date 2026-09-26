using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CircuitoVR.IconKit
{
    /// <summary>
    /// Hover/press de botão com ícone 3D pré-renderizado, para Canvas em world-space
    /// (funciona com o XR UI Input Module / TrackedDeviceGraphicRaycaster e com mouse).
    ///
    /// Hierarquia sugerida (ver README):
    ///   Button (Image = placa, VRIconButton)
    ///     Glow  (Image = *_glow.png, raycastTarget off)
    ///     Icon  (RawImage = *_idle.png, raycastTarget off)
    ///     Label (TextMeshProUGUI, opcional)
    ///
    /// No hover: a placa troca de sprite, o halo acende, o ícone sai do vidro em
    /// direção ao usuário (eixo -Z do Canvas), inclina para o ponto do raio e toca o
    /// flipbook *_hover_sheet.png em laço. Ao sair, o laço termina antes de voltar ao
    /// quadro de repouso, então não há "salto".
    /// </summary>
    [DisallowMultipleComponent]
    public class VRIconButton : MonoBehaviour,
        IPointerEnterHandler, IPointerExitHandler, IPointerDownHandler, IPointerUpHandler, IPointerMoveHandler
    {
        [Header("Placa (Plates/square_<estilo>_<estado>.png)")]
        public Image plate;
        public Sprite plateNormal, plateHover, platePressed, plateDisabled;

        [Header("Halo (Plates/square_<estilo>_glow.png)")]
        public Graphic glow;
        [Range(0, 1)] public float glowIdle = 0.45f;
        [Range(0, 1)] public float glowHover = 1f;

        [Header("Ícone (Icons/<id>_idle.png + HoverSheets/<id>_hover_sheet.png)")]
        public RawImage icon;
        public Texture iconIdle;
        public Texture iconHoverSheet;
        public int sheetColumns = 4;
        public int sheetRows = 4;
        [Tooltip("Duração de um laço do flipbook (a exportação usa 1,33 s).")]
        public float loopSeconds = 1.33f;
        [Tooltip("Transform que se move no hover. Vazio = o RectTransform do ícone.")]
        public RectTransform iconTransform;

        [Header("Movimento")]
        public float hoverScale = 1.07f;
        public float pressedScale = 0.93f;
        [Tooltip("Quanto o ícone sai do vidro, em unidades locais do Canvas (com Canvas em escala 0,001, 12 = 12 mm).")]
        public float hoverLift = 12f;
        [Tooltip("Inclinação máxima em graus na direção do ponto apontado.")]
        public float maxTilt = 14f;
        public float smoothing = 14f;

        [Header("Interação")]
        [Tooltip("Opcional: respeita Selectable.interactable (ex.: Button).")]
        public Selectable selectable;

        [Header("Som (opcional)")]
        public AudioSource audioSource;
        public AudioClip hoverClip, pressClip;

        [Header("Eventos")]
        public UnityEvent onHoverEnter, onHoverExit;

        float _h, _p, _t;
        bool _hovered, _pressed, _playing;
        Vector2 _tilt;
        Vector3 _basePos, _baseScale;
        Quaternion _baseRot;

        public bool Interactable => selectable == null || selectable.IsInteractable();

        void Awake()
        {
            if (selectable == null) selectable = GetComponent<Selectable>();
            if (plate == null) plate = GetComponent<Image>();
            if (iconTransform == null && icon != null) iconTransform = icon.rectTransform;
            if (iconTransform != null)
            {
                _basePos = iconTransform.localPosition;
                _baseScale = iconTransform.localScale;
                _baseRot = iconTransform.localRotation;
            }
            if (icon != null) icon.raycastTarget = false;
            if (glow != null) glow.raycastTarget = false;
            ShowIdle();
            if (plate != null && plateNormal != null) plate.sprite = plateNormal;
        }

        void OnDisable()
        {
            _hovered = _pressed = _playing = false;
            _h = _p = _t = 0;
            Apply();
            ShowIdle();
        }

        /// <summary>Troca o ícone (ex.: Pausar ↔ Continuar, Som ↔ Sem som).</summary>
        public void SetIcon(Texture idle, Texture hoverSheet)
        {
            iconIdle = idle;
            iconHoverSheet = hoverSheet;
            _t = 0;
            if (_hovered) _playing = true; else ShowIdle();
        }

        /// <summary>Troca o estilo da placa (ex.: quiet → danger no "Confirmar?").</summary>
        public void SetPlate(Sprite normal, Sprite hover, Sprite pressed, Sprite disabled = null)
        {
            plateNormal = normal; plateHover = hover; platePressed = pressed;
            if (disabled != null) plateDisabled = disabled;
        }

        public void OnPointerEnter(PointerEventData e)
        {
            if (!Interactable) return;
            _hovered = true;
            _playing = true;
            if (audioSource && hoverClip) audioSource.PlayOneShot(hoverClip);
            onHoverEnter.Invoke();
        }

        public void OnPointerExit(PointerEventData e)
        {
            if (!_hovered) return;
            _hovered = false;
            _pressed = false;
            _tilt = Vector2.zero;
            onHoverExit.Invoke();
        }

        public void OnPointerDown(PointerEventData e)
        {
            if (!Interactable) return;
            _pressed = true;
            if (audioSource && pressClip) audioSource.PlayOneShot(pressClip);
        }

        public void OnPointerUp(PointerEventData e) => _pressed = false;

        public void OnPointerMove(PointerEventData e)
        {
            if (!_hovered) return;
            var rt = (RectTransform)transform;
            var world = e.pointerCurrentRaycast.worldPosition;
            if (world == Vector3.zero) return;
            Vector2 local = rt.InverseTransformPoint(world);
            var r = rt.rect;
            _tilt = new Vector2(
                Mathf.Clamp((local.x - r.center.x) / (r.width * 0.5f), -1, 1),
                Mathf.Clamp((local.y - r.center.y) / (r.height * 0.5f), -1, 1));
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            float k = 1 - Mathf.Exp(-smoothing * dt);
            bool interactable = Interactable;
            _h = Mathf.Lerp(_h, _hovered && interactable ? 1 : 0, k);
            _p = Mathf.Lerp(_p, _pressed && interactable ? 1 : 0, 1 - Mathf.Exp(-smoothing * 2 * dt));

            if (_playing && iconHoverSheet != null)
            {
                _t += dt / Mathf.Max(0.05f, loopSeconds);
                if (_t >= 1)
                {
                    _t = 0;
                    if (!_hovered) _playing = false;
                }
            }

            if (plate != null)
            {
                Sprite s = !interactable ? (plateDisabled ? plateDisabled : plateNormal)
                    : _p > 0.5f ? (platePressed ? platePressed : plateNormal)
                    : _hovered ? (plateHover ? plateHover : plateNormal)
                    : plateNormal;
                if (s != null && plate.sprite != s) plate.sprite = s;
            }

            if (glow != null)
            {
                var c = glow.color;
                c.a = interactable ? Mathf.Lerp(glowIdle, glowHover, _h) : 0;
                glow.color = c;
            }

            if (icon != null)
            {
                if (_playing && iconHoverSheet != null) ShowFrame(_t);
                else ShowIdle();
                icon.color = interactable ? Color.white : new Color(0.6f, 0.6f, 0.6f, 0.45f);
            }

            Apply();
        }

        void Apply()
        {
            if (iconTransform == null) return;
            float scale = Mathf.Lerp(1, hoverScale, _h) * Mathf.Lerp(1, pressedScale, _p);
            iconTransform.localScale = _baseScale * scale;
            // -Z do Canvas aponta para quem olha a UI
            iconTransform.localPosition = _basePos + new Vector3(0, 0, -hoverLift * _h + hoverLift * 0.5f * _p);
            iconTransform.localRotation = _baseRot * Quaternion.Euler(_tilt.y * maxTilt * _h, -_tilt.x * maxTilt * _h, 0);
        }

        void ShowIdle()
        {
            if (icon == null) return;
            if (iconIdle != null && icon.texture != iconIdle) icon.texture = iconIdle;
            icon.uvRect = new Rect(0, 0, 1, 1);
        }

        void ShowFrame(float t)
        {
            int frames = sheetColumns * sheetRows;
            int f = Mathf.Clamp(Mathf.FloorToInt(t * frames), 0, frames - 1);
            int col = f % sheetColumns, row = f / sheetColumns;
            if (icon.texture != iconHoverSheet) icon.texture = iconHoverSheet;
            // a folha começa no canto superior esquerdo; UV do Unity começa embaixo
            icon.uvRect = new Rect((float)col / sheetColumns, 1f - (row + 1f) / sheetRows, 1f / sheetColumns, 1f / sheetRows);
        }
    }
}
