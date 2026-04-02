import PostEditorScreen from '@/components/posts/PostEditorScreen';

interface NewGroupPostPageProps {
  params: Promise<{groupId: string}>;
}

export default async function NewGroupPostPage({params}: NewGroupPostPageProps) {
  const {groupId} = await params;
  return <PostEditorScreen scope="group" groupId={groupId} />;
}
