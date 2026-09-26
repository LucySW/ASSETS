using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;

namespace CircuitoVR.IconKit
{
    /// <summary>
    /// Hover para os ícones 3D reais (Models/*.glb importados com glTFast).
    ///
    /// Coloque este componente num objeto pai do modelo. O hover levanta o ícone em
    /// direção ao usuário (-forward: os modelos já saem virados para -Z, como um Quad),
    /// aumenta um pouco, inclina para o raio, reforça a emissão dos materiais e toca o
    /// clipe "hover" embutido no GLB.
    ///
    /// Entradas de hover:
    ///  - EventSystem (PhysicsRaycaster na câmera + Collider neste objeto), ou
    ///  - XR Interaction Toolkit: ligue os eventos Hover Entered/Exited de um
    ///    XRSimpleInteractable a HoverEnter()/HoverExit() e Select a Press()/Release().
    /// </summary>
    public class VRIcon3D : MonoBehaviour,
        IPointerEnterHandler, IPointerExitHandler, IPointerDownHandler, IPointerUpHandler
    {
        [Tooltip("Objeto que se move no hover. Vazio = primeiro filho (o modelo importado).")]
        public Transform visual;

        [Header("Movimento")]
        [Tooltip("Metros em direção ao usuário.")]
        public float hoverLift = 0.012f;
        public float hoverScale = 1.08f;
        public float pressedScale = 0.92f;
        public float maxTilt = 12f;
        public float smoothing = 14f;
        [Tooltip("Flutuação suave em repouso (0 desliga).")]
        public float idleBob = 0.002f;

        [Header("Brilho")]
        [Tooltip("Multiplicador da emissão no hover.")]
        public float emissionBoost = 2.2f;

        [Header("Animação embutida")]
        public string hoverClip = "hover";

        [Header("Eventos")]
        public UnityEvent onHoverEnter, onHoverExit, onClick;

        static readonly int EmissionColor = Shader.PropertyToID("_EmissionColor");  // URP/HDRP Lit
        static readonly int EmissiveFactor = Shader.PropertyToID("emissiveFactor"); // shaders do glTFast

        float _h, _p;
        bool _hovered, _pressed, _stopAfterLoop;
        float _lastAnimTime;
        Vector3 _basePos, _baseScale;
        Quaternion _baseRot;
        Renderer[] _renderers;
        Color[][] _baseEmission;
        MaterialPropertyBlock _mpb;
        Animation _anim;
        Animator _animator;
        Transform _viewer;

        void Awake()
        {
            if (visual == null) visual = transform.childCount > 0 ? transform.GetChild(0) : transform;
            _basePos = visual.localPosition;
            _baseScale = visual.localScale;
            _baseRot = visual.localRotation;
            _renderers = GetComponentsInChildren<Renderer>();
            _mpb = new MaterialPropertyBlock();
            _baseEmission = new Color[_renderers.Length][];
            for (int i = 0; i < _renderers.Length; i++)
            {
                var mats = _renderers[i].sharedMaterials;
                _baseEmission[i] = new Color[mats.Length];
                for (int m = 0; m < mats.Length; m++)
                {
                    var mat = mats[m];
                    if (mat == null) continue;
                    if (mat.HasProperty(EmissionColor)) _baseEmission[i][m] = mat.GetColor(EmissionColor);
                    else if (mat.HasProperty(EmissiveFactor)) _baseEmission[i][m] = mat.GetColor(EmissiveFactor);
                }
            }
            _anim = GetComponentInChildren<Animation>();
            _animator = GetComponentInChildren<Animator>();
            if (_anim != null) _anim.playAutomatically = false;
            if (Camera.main != null) _viewer = Camera.main.transform;
        }

        public void HoverEnter()
        {
            if (_hovered) return;
            _hovered = true;
            _stopAfterLoop = false;
            PlayClip();
            onHoverEnter.Invoke();
        }

        public void HoverExit()
        {
            if (!_hovered) return;
            _hovered = false;
            _pressed = false;
            _stopAfterLoop = true; // deixa o laço terminar e volta à pose de repouso
            if (_animator != null) _animator.SetBool("Hover", false);
            onHoverExit.Invoke();
        }

        public void Press() => _pressed = true;

        public void Release()
        {
            if (_pressed && _hovered) onClick.Invoke();
            _pressed = false;
        }

        public void OnPointerEnter(PointerEventData e) => HoverEnter();
        public void OnPointerExit(PointerEventData e) => HoverExit();
        public void OnPointerDown(PointerEventData e) => Press();
        public void OnPointerUp(PointerEventData e) => Release();

        void PlayClip()
        {
            if (_animator != null) { _animator.SetBool("Hover", true); return; }
            if (_anim == null || _anim[hoverClip] == null) return;
            var st = _anim[hoverClip];
            st.wrapMode = WrapMode.Loop;
            if (!_anim.IsPlaying(hoverClip)) { st.time = 0; _anim.Play(hoverClip); }
            _lastAnimTime = 0;
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            _h = Mathf.Lerp(_h, _hovered ? 1 : 0, 1 - Mathf.Exp(-smoothing * dt));
            _p = Mathf.Lerp(_p, _pressed ? 1 : 0, 1 - Mathf.Exp(-smoothing * 2 * dt));

            // Movimento: -forward aponta para o usuário
            Vector3 toViewer = Vector3.back;
            float bob = idleBob * Mathf.Sin(Time.time * 1.6f + transform.position.x * 7f) * (1 - _h);
            visual.localPosition = _basePos + toViewer * (hoverLift * _h - hoverLift * 0.5f * _p) + Vector3.up * bob;
            visual.localScale = _baseScale * Mathf.Lerp(1, hoverScale, _h) * Mathf.Lerp(1, pressedScale, _p);

            Quaternion tilt = Quaternion.identity;
            if (_viewer != null && _h > 0.001f)
            {
                Vector3 local = transform.InverseTransformPoint(_viewer.position);
                float yaw = Mathf.Clamp(Mathf.Atan2(local.x, -local.z) * Mathf.Rad2Deg, -maxTilt, maxTilt);
                float pitch = Mathf.Clamp(Mathf.Atan2(local.y, -local.z) * Mathf.Rad2Deg, -maxTilt, maxTilt);
                tilt = Quaternion.Euler(pitch * _h, -yaw * _h, 0);
            }
            visual.localRotation = _baseRot * tilt;

            // Emissão
            float boost = Mathf.Lerp(1, emissionBoost, _h);
            for (int i = 0; i < _renderers.Length; i++)
            {
                var r = _renderers[i];
                for (int m = 0; m < _baseEmission[i].Length; m++)
                {
                    r.GetPropertyBlock(_mpb, m);
                    Color c = _baseEmission[i][m] * boost + new Color(0.04f, 0.08f, 0.2f) * _h;
                    _mpb.SetColor(EmissionColor, c);
                    _mpb.SetColor(EmissiveFactor, c);
                    r.SetPropertyBlock(_mpb, m);
                }
            }

            // Fim do laço após sair do hover
            if (_stopAfterLoop && _anim != null && _anim[hoverClip] != null && _anim.IsPlaying(hoverClip))
            {
                var st = _anim[hoverClip];
                float t = st.time % st.length;
                if (t < _lastAnimTime)
                {
                    _anim.Stop(hoverClip);
                    st.time = 0;
                    st.enabled = true; st.weight = 1; _anim.Sample(); st.enabled = false;
                    _stopAfterLoop = false;
                }
                _lastAnimTime = t;
            }
            else if (_anim != null && _anim[hoverClip] != null)
            {
                _lastAnimTime = _anim[hoverClip].time % Mathf.Max(0.0001f, _anim[hoverClip].length);
            }
        }
    }
}
