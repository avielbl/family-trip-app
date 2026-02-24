import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckSquare, Square, Plus, Package, Trash2 } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { savePackingItem, togglePackingItem, deletePackingItem } from '../firebase/tripService';

const PackingPage: React.FC = () => {
  const { t } = useTranslation();
  const { packingItems, tripCode, config, isAdmin } = useTripContext();
  const [activeTab, setActiveTab] = useState<string>('shared');
  const [newItemText, setNewItemText] = useState('');

  const filteredItems = useMemo(
    () => packingItems.filter((item) => item.category === activeTab),
    [packingItems, activeTab]
  );

  const checkedCount = filteredItems.filter((item) => item.checked).length;
  const totalCount = filteredItems.length;

  const handleToggle = (itemId: string, currentChecked: boolean) => {
    if (!tripCode) return;
    togglePackingItem(tripCode, itemId, !currentChecked);
  };

  const handleAddItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;

    const newItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      checked: false,
      category: activeTab,
    };

    if (!tripCode) return;
    savePackingItem(tripCode, newItem);
    setNewItemText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { handleAddItem(); }
  };

  const handleDeleteItem = (itemId: string) => {
    if (!tripCode) return;
    deletePackingItem(tripCode, itemId);
  };

  return (
    <div className="packing-page">
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Package size={22} />
        {t('packing.title')}
      </h1>

      <div className="packing-tabs">
        <button
          className={`packing-tab ${activeTab === 'shared' ? 'packing-tab--active' : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          {t('packing.shared')}
        </button>
        {config?.familyMembers.map((member) => (
          <button
            key={member.id}
            className={`packing-tab ${activeTab === member.id ? 'packing-tab--active' : ''}`}
            onClick={() => setActiveTab(member.id)}
          >
            {member.emoji} {member.name}
          </button>
        ))}
      </div>

      <div className="packing-section">
        <div className="packing-progress">
          {t('packing.itemsChecked', { checked: checkedCount, total: totalCount })}
        </div>

        <ul>
          {filteredItems.map((item) => (
            <li
              key={item.id}
              className={`packing-item ${item.checked ? 'packing-checked' : ''}`}
              onClick={() => handleToggle(item.id, item.checked)}
            >
              <span className="packing-checkbox">
                {item.checked ? <CheckSquare size={20} /> : <Square size={20} />}
              </span>
              <span className="packing-text" style={{ flex: 1 }}>
                {item.text}
              </span>
              {isAdmin && (
                <button
                  className="admin-icon-btn delete"
                  style={{ padding: '4px 6px' }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="packing-add">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('packing.addItem')}
          />
          <button onClick={handleAddItem} disabled={!newItemText.trim()}>
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PackingPage;
