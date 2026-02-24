import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthContext';
import type { FamilyMember } from '../types/trip';

interface Props {
  virtualMembers: FamilyMember[];
  onClose: () => void;
}

export default function VirtualMemberPicker({ virtualMembers, onClose }: Props) {
  const { i18n } = useTranslation();
  const { selectVirtualMember } = useAuthContext();
  const isHe = i18n.language === 'he';

  function handleSelect(member: FamilyMember) {
    selectVirtualMember(member);
    onClose();
  }

  return (
    <div className="menu-overlay" onClick={onClose}>
      <div
        className="virtual-picker"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{isHe ? 'מי אתה/את?' : 'Who are you?'}</h2>
        <p className="virtual-picker-hint">
          {isHe
            ? 'בחר/י את דמותך כדי להמשיך'
            : 'Select your character to continue'}
        </p>
        <div className="member-grid">
          {virtualMembers.map((member) => (
            <button
              key={member.id}
              className="member-card"
              onClick={() => handleSelect(member)}
            >
              <span className="member-emoji">{member.emoji}</span>
              <span className="member-name">
                {isHe ? member.nameHe : member.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
