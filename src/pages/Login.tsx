import { useSession } from '../lib/session';
import kneelingWarrior from '../assets/brand/warrior-kneeling.png';

// The sign-in splash. The kneeling Warrior leads — a knight kneels to receive a
// charge, which is the whole idea of a steward. Microsoft 365 SSO is the only
// way in (faked for the demo; clicking enters as the current "view as" user).
export default function Login() {
  const { signIn } = useSession();
  return (
    <div className="signin">
      <img className="signin-hero" src={kneelingWarrior} alt="Westminster Warrior" />
      <div className="signin-mark">STEWARD</div>
      <div className="signin-rule" />
      <div className="signin-verse">1 Peter 4:10&ndash;11</div>
      <button className="signin-btn" onClick={signIn}>
        <i className="ti ti-brand-windows" style={{ fontSize: 18 }} />
        Sign in with Microsoft 365
      </button>
      <div className="signin-foot">Westminster Christian School</div>
    </div>
  );
}
