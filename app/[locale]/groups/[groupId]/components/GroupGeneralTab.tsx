'use client';

import { useState, useEffect } from 'react';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import { modifyGroupBase, deleteGroup } from '@/lib/api/groups';
import { Copy, AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface GroupGeneralTabProps {
  groupData?: any;
}

export function GroupGeneralTab({ groupData }: GroupGeneralTabProps) {
  const { groupId, hasPermission } = useGroupPermission();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canModify = hasPermission('group.modify.base');
  const canDelete = hasPermission('group.delete.group');

  // Initialize form state
  useEffect(() => {
    if (groupData) {
      setName(groupData.name || groupData.group_name || '');
      setDescription(groupData.description || groupData.group_description || '');
    }
  }, [groupData]);

  const originalName = groupData?.name || groupData?.group_name || '';
  const originalDesc = groupData?.description || groupData?.group_description || '';
  const isDirty = name !== originalName || description !== originalDesc;

  const handleSave = async () => {
    if (!canModify || !isDirty) return;
    try {
      setIsSaving(true);
      await modifyGroupBase({
        group_id: groupId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Csoport adatai frissítve');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Hiba történt a mentés során');
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(groupId);
    toast.success('ID vágólapra másolva');
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== originalName) return;
    try {
      setIsDeleting(true);
      await deleteGroup(groupId);
      toast.success('Csoport törölve');
      window.location.href = '/groups'; // Redirect to groups list
    } catch (err) {
      console.error(err);
      toast.error('Hiba történt a törlés során');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Alapadatok */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">Alapadatok</h2>
          <p className="text-sm text-gray-400">A csoport alapvető beállításainak kezelése.</p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="groupName" className="text-sm font-medium text-gray-300">
              Csoport neve
            </label>
            <input
              id="groupName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canModify}
              className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:opacity-50"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="groupDesc" className="text-sm font-medium text-gray-300">
              Leírás (opcionális)
            </label>
            <textarea
              id="groupDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canModify}
              rows={4}
              className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:opacity-50 resize-none"
            />
          </div>

          {canModify && isDirty && (
            <div className="flex justify-end pt-2">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || !name.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white border-none"
              >
                {isSaving ? 'Mentés...' : 'Változtatások mentése'}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Csoport Azonosító (ID) */}
      <section className="space-y-4 pt-4 border-t border-white/5">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">Csoport Azonosító</h2>
          <p className="text-sm text-gray-400">Ez a csoport egyedi azonosítója (ID).</p>
        </div>
        
        <div className="flex items-center justify-between bg-[#111] border border-white/10 rounded-lg p-4">
          <code className="font-mono text-sm text-gray-300 select-all truncate mr-4">
            {groupId}
          </code>
          <Button 
            onClick={copyToClipboard}
            variant="secondary" 
            className="shrink-0 bg-white/5 hover:bg-white/10 border-white/10"
            startIcon={<Copy size={16} />}
          >
            Másolás
          </Button>
        </div>
      </section>

      {/* Veszélyzóna */}
      {canDelete && (
        <section className="space-y-4 pt-8">
          <div className="border border-red-900/50 bg-red-950/10 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-medium text-red-500 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Veszélyzóna
                </h2>
                <p className="text-sm text-red-400/80">
                  A csoport törlése végleges és nem vonható vissza. Minden adat elvész.
                </p>
              </div>
              <Button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none transition-colors"
                startIcon={<Trash2 size={16} />}
              >
                Csoport törlése
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {canDelete && (
        <Modal 
          open={isDeleteModalOpen} 
          title="Csoport törlése" 
          onClose={() => setIsDeleteModalOpen(false)}
        >
          <div className="space-y-5">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">
              Figyelem: Ez a művelet végleges. Törölni fogja a csoportot és az összes hozzá tartozó adatot.
            </div>
            
            <div className="space-y-2">
              <label htmlFor="confirmName" className="text-sm text-gray-300">
                Kérlek, gépeld be a csoport nevét (<span className="font-bold text-white select-none">{originalName}</span>) a folytatáshoz:
              </label>
              <input
                id="confirmName"
                type="text"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all"
                placeholder={originalName}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                variant="secondary"
                className="bg-white/5 hover:bg-white/10 border-white/10 text-white"
              >
                Mégse
              </Button>
              <Button 
                onClick={handleDelete}
                disabled={deleteConfirmText !== originalName || isDeleting}
                className="bg-red-500 hover:bg-red-600 text-white border-none disabled:bg-red-500/50"
              >
                {isDeleting ? 'Törlés...' : 'Törlés megerősítése'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
