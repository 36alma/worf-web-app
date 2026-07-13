'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import { modifyGroupBase, deleteGroup } from '@/lib/api/groups';
import { Copy, AlertTriangle, Trash2, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import FieldError from '@/components/ui/FieldError';
import { requiredText, optionalText } from '@/lib/validation';
import { useTranslations } from 'next-intl';
import clsx from 'clsx';

interface GroupGeneralTabProps {
  groupData?: any;
}

interface FormData {
  name: string;
  description: string;
}

export function GroupGeneralTab({ groupData }: GroupGeneralTabProps) {
  const t = useTranslations('group_detail.general');
  const tv = useTranslations('validation');
  const { groupId, hasPermission } = useGroupPermission();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const canModify = hasPermission('group.modify.base');
  const canDelete = hasPermission('group.delete.group');

  const formSchema = useMemo(
    () => z.object({ name: requiredText(150), description: optionalText(1000) }),
    []
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isValid, errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Initialize form state when data arrives
  useEffect(() => {
    if (groupData) {
      reset({
        name: groupData.name || groupData.group_name || '',
        description: groupData.description || groupData.group_description || '',
      });
    }
  }, [groupData, reset]);

  const originalName = groupData?.name || groupData?.group_name || '';

  const onSubmit = async (data: FormData) => {
    if (!canModify) return;
    try {
      setIsSaving(true);
      await modifyGroupBase({
        group_id: groupId,
        name: data.name.trim(),
        description: data.description.trim() || undefined,
      });
      toast.success(t('save_success'));
      // We don't necessarily need a reload if we want a SPA feel, 
      // but the prompt implies updating the header etc. 
      // Refreshing the page is the simplest way to ensure all components get the new data.
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    // raw group_id as requested
    navigator.clipboard.writeText(groupId);
    setIsCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== originalName || !canDelete) return;
    try {
      setIsDeleting(true);
      await deleteGroup(groupId);
      toast.success(t('delete_success'));
      window.location.href = '/groups'; // Redirect to groups list
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Alapadatok */}
      <section className="space-y-6 bg-[#1a1a1a]/40 border border-white/5 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-orange-500 rounded-full" />
            {t('title')}
          </h2>
          <p className="text-sm text-gray-400 ml-3.5">{t('description')}</p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="groupName" className="text-sm font-medium text-gray-300 ml-1">
              {t('name_label')}
            </label>
            <input
              id="groupName"
              type="text"
              {...register('name')}
              disabled={!canModify || isSaving}
              className={clsx(
                "w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all",
                !canModify && "opacity-50 cursor-not-allowed bg-white/5"
              )}
            />
            <FieldError messages={errors.name?.message ? tv(errors.name.message as never) : undefined} />
          </div>

          <div className="space-y-2">
            <label htmlFor="groupDesc" className="text-sm font-medium text-gray-300 ml-1">
              {t('desc_label')}
            </label>
            <textarea
              id="groupDesc"
              {...register('description')}
              disabled={!canModify || isSaving}
              rows={4}
              className={clsx(
                "w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none",
                !canModify && "opacity-50 cursor-not-allowed bg-white/5"
              )}
            />
            <FieldError messages={errors.description?.message ? tv(errors.description.message as never) : undefined} />
          </div>

          {canModify && (
            <div className="flex justify-end pt-2">
              <Button 
                type="submit"
                disabled={isSaving || !isValid || !isDirty}
                className="bg-orange-500 hover:bg-orange-600 text-white border-none min-w-[140px] shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    {t('saving')}
                  </div>
                ) : (
                  t('save_button')
                )}
              </Button>
            </div>
          )}
        </form>
      </section>

      {/* Csoport Azonosító (ID) */}
      <section className="space-y-4 pt-4 border-t border-white/5">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">{t('id_title')}</h2>
          <p className="text-sm text-gray-400">{t('id_description')}</p>
        </div>
        
        <div className="flex items-center justify-between bg-[#1a1a1a]/60 border border-white/10 rounded-xl p-4 group">
          <code className="font-mono text-sm text-gray-300 select-all truncate mr-4">
            {groupId}
          </code>
          <Button 
            onClick={copyToClipboard}
            variant="secondary" 
            className="shrink-0 bg-white/5 hover:bg-white/10 border-white/10 text-white h-10 w-10 p-0 sm:w-auto sm:px-4"
            startIcon={isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          >
            <span className="hidden sm:inline">{t('copy_button')}</span>
          </Button>
        </div>
      </section>

      {/* Veszélyzóna */}
      {canDelete && (
        <section className="space-y-4 pt-8">
          <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  {t('danger_zone')}
                </h2>
                <p className="text-sm text-gray-400 max-w-xl">
                  {t('danger_description')}
                </p>
              </div>
              <Button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20 transition-all"
                startIcon={<Trash2 size={18} />}
              >
                {t('delete_button')}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {canDelete && (
        <Modal 
          open={isDeleteModalOpen} 
          title={t('delete_modal_title')} 
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
              setDeleteConfirmText('');
            }
          }}
        >
          <div className="space-y-6 p-1">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="text-red-500 shrink-0" size={20} />
              <p className="text-sm text-red-200/80 leading-relaxed">
                {t('delete_modal_warning')}
              </p>
            </div>
            
            <div className="space-y-3">
              <label htmlFor="confirmName" className="text-sm text-gray-400 block px-1">
                {t('delete_modal_prompt', { name: originalName })}
              </label>
              <input
                id="confirmName"
                type="text"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={isDeleting}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                placeholder={originalName}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                disabled={isDeleting}
                variant="secondary"
                className="bg-white/5 hover:bg-white/10 border-white/10 text-white min-w-[100px]"
              >
                {t('delete_modal_cancel')}
              </Button>
              <Button 
                onClick={handleDelete}
                disabled={deleteConfirmText !== originalName || isDeleting}
                className="bg-red-500 hover:bg-red-600 text-white border-none min-w-[140px] shadow-lg shadow-red-500/20"
              >
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    {t('delete_modal_deleting')}
                  </div>
                ) : (
                  t('delete_modal_confirm')
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
