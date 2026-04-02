import PostEditorScreen from '@/components/posts/PostEditorScreen';

interface EditGroupPostPageProps {
  params: Promise<{groupId: string; postId: string}>;
}

export default async function EditGroupPostPage({params}: EditGroupPostPageProps) {
  const {groupId, postId} = await params;
  return <PostEditorScreen scope="group" groupId={groupId} postId={postId} />;
}
